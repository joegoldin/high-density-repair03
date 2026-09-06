// @ts-nocheck
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import type { SimpleRouteJson, SimplifiedPcbTrace } from "../types"
import type { HighDensityRoute } from "../types/high-density-types"
import { getConnectionPointLayers } from "../types/srj-types"
import { mapZToLayerName } from "./mapZToLayerName"
import type { LayerName } from "./mapZToLayerName"
import {
  getPcbObstaclePrimitives,
  type PcbObstaclePrimitive,
} from "./getPcbObstaclePrimitives"

/**
 * Convert a simplified PCB trace from the autorouter to a circuit-json compatible PCB trace
 */
function convertSimplifiedPcbTraceToCircuitJson(
  simplifiedTrace: SimplifiedPcbTrace,
  connectionName: string,
): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id: simplifiedTrace.pcb_trace_id,
    source_trace_id: connectionName,
    route: simplifiedTrace.route
      .map((segment) => {
        if (segment.route_type === "wire") {
          return {
            route_type: "wire" as const,
            x: segment.x,
            y: segment.y,
            width: segment.width,
            layer: segment.layer as LayerName,
            start_pcb_port_id: (segment as any).start_pcb_port_id,
            end_pcb_port_id: (segment as any).end_pcb_port_id,
          }
        } else if (segment.route_type === "via") {
          return {
            route_type: "via" as const,
            x: segment.x,
            y: segment.y,
            from_layer: segment.from_layer,
            to_layer: segment.to_layer,
          }
        } else {
          // jumper - skip for now as circuit-json doesn't support jumper route type
          return null
        }
      })
      .filter((segment) => segment !== null),
  }
}

/**
 * Convert a high density route from the autorouter to circuit-json compatible PCB traces.
 * When a route contains jumpers, it splits into multiple disjoint traces that share the
 * same source_trace_id (since they're electrically connected through the jumper component).
 */
function convertHdRouteToCircuitJsonTraces(
  hdRoute: HighDensityRoute,
  baseId: string,
  connectionName: string,
  width = 0.1,
): PcbTrace[] {
  const traces: PcbTrace[] = []

  // If no jumpers, return single trace
  if (!hdRoute.jumpers || hdRoute.jumpers.length === 0) {
    return [
      {
        type: "pcb_trace",
        pcb_trace_id: baseId,
        source_trace_id: connectionName,
        route: hdRoute.route.map((point, index) => {
          const isFirstPoint = index === 0
          const isLastPoint = index === hdRoute.route.length - 1
          return {
            route_type: "wire",
            x: point.x,
            y: point.y,
            width,
            layer: mapZToLayerName(point.z, 2),
            ...(isFirstPoint && (point as any).pcb_port_id
              ? { start_pcb_port_id: (point as any).pcb_port_id }
              : {}),
            ...(isLastPoint && (point as any).pcb_port_id
              ? { end_pcb_port_id: (point as any).pcb_port_id }
              : {}),
          }
        }),
      },
    ]
  }

  // Build a set of jumper endpoint indices (where we need to split the trace)
  // Each jumper creates a "gap" in the trace
  const jumperEndpoints: Array<{
    startIdx: number
    endIdx: number
  }> = []

  for (const jumper of hdRoute.jumpers) {
    let startIdx = -1
    let endIdx = -1

    for (let i = 0; i < hdRoute.route.length; i++) {
      const p = hdRoute.route[i]
      if (
        Math.abs(p.x - jumper.start.x) < 0.01 &&
        Math.abs(p.y - jumper.start.y) < 0.01
      ) {
        startIdx = i
      }
      if (
        Math.abs(p.x - jumper.end.x) < 0.01 &&
        Math.abs(p.y - jumper.end.y) < 0.01
      ) {
        endIdx = i
      }
    }

    if (startIdx !== -1 && endIdx !== -1) {
      // Ensure startIdx < endIdx
      if (startIdx > endIdx) {
        ;[startIdx, endIdx] = [endIdx, startIdx]
      }
      jumperEndpoints.push({ startIdx, endIdx })
    }
  }

  // Sort jumper endpoints by startIdx
  jumperEndpoints.sort((a, b) => a.startIdx - b.startIdx)

  // Split the route into segments between jumpers
  let currentStart = 0
  let traceIndex = 0

  for (const { startIdx, endIdx } of jumperEndpoints) {
    // Create trace from currentStart to startIdx (inclusive)
    if (startIdx >= currentStart) {
      const segmentPoints = hdRoute.route.slice(currentStart, startIdx + 1)
      if (segmentPoints.length > 0) {
        traces.push({
          type: "pcb_trace",
          pcb_trace_id: `${baseId}_${traceIndex}`,
          source_trace_id: connectionName,
          route: segmentPoints.map((point, index) => {
            const isFirstPoint = index === 0 && currentStart === 0
            const isLastPoint = false // Not the overall last point
            return {
              route_type: "wire",
              x: point.x,
              y: point.y,
              width,
              layer: mapZToLayerName(point.z, 2),
              ...(isFirstPoint && (point as any).pcb_port_id
                ? { start_pcb_port_id: (point as any).pcb_port_id }
                : {}),
            }
          }),
        })
        traceIndex++
      }
    }
    // Skip from startIdx to endIdx (this is the jumper segment)
    currentStart = endIdx
  }

  // Create final trace from last jumper end to route end
  if (currentStart < hdRoute.route.length) {
    const segmentPoints = hdRoute.route.slice(currentStart)
    if (segmentPoints.length > 0) {
      const isLastSegment = true
      traces.push({
        type: "pcb_trace",
        pcb_trace_id: `${baseId}_${traceIndex}`,
        source_trace_id: connectionName,
        route: segmentPoints.map((point, index) => {
          const isLastPoint =
            isLastSegment && index === segmentPoints.length - 1
          return {
            route_type: "wire",
            x: point.x,
            y: point.y,
            width,
            layer: mapZToLayerName(point.z, 2),
            ...(isLastPoint && (point as any).pcb_port_id
              ? { end_pcb_port_id: (point as any).pcb_port_id }
              : {}),
          }
        }),
      })
    }
  }

  return traces
}

/**
 * Create source_trace elements from the SimpleRouteJson connections
 * These represent the logical connections between points
 */
function createSourceTraces(
  srj: SimpleRouteJson,
  primitives: PcbObstaclePrimitive[],
): AnyCircuitElement[] {
  const sourceTraces: AnyCircuitElement[] = []

  // Process each connection to create a source_trace
  srj.connections.forEach((connection) => {
    const aliases = getConnectionAliases(connection)
    const connectedPortIds = [
      ...new Set([
        ...aliases,
        ...primitives
          .filter((primitive) =>
            aliases.some(
              (alias) =>
                primitive.obstacle.connectedTo.includes(alias) ||
                primitive.pcbPortId === alias,
            ),
          )
          .flatMap((primitive) => [
            ...primitive.obstacle.connectedTo,
            ...(primitive.pcbPortId ? [primitive.pcbPortId] : []),
          ]),
      ]),
    ].sort()

    // Look for original connection name (might be MST-suffixed by NetToPointPairsSolver)
    const netConnectionName =
      connection.netConnectionName ||
      connection.rootConnectionName ||
      connection.name

    // Check if this source_trace already exists
    const existingSourceTrace = sourceTraces.find(
      (st) =>
        st.type === "source_trace" && st.source_trace_id === netConnectionName,
    )

    if (existingSourceTrace) {
      // Add these port IDs to the existing source_trace
      const sourceTrace = existingSourceTrace as any
      sourceTrace.connected_source_port_ids = [
        ...new Set([
          ...sourceTrace.connected_source_port_ids,
          ...connectedPortIds,
        ]),
      ]
    } else {
      // Create a new source_trace for this connection
      sourceTraces.push({
        type: "source_trace",
        source_trace_id: netConnectionName,
        connected_source_port_ids: connectedPortIds,
        connected_source_net_ids: [],
      })
    }
  })

  return sourceTraces
}

/**
 * Create circuit-json pcb_port elements for the connection points
 */
function createPcbPorts(
  srj: SimpleRouteJson,
  primitives: PcbObstaclePrimitive[],
): AnyCircuitElement[] {
  const portMap = new Map<string, any>()

  srj.connections.forEach((connection) => {
    connection.pointsToConnect.forEach((point) => {
      if (point.pcb_port_id) {
        portMap.set(point.pcb_port_id, {
          type: "pcb_port",
          pcb_port_id: point.pcb_port_id,
          source_port_id: point.pcb_port_id, // Assuming same ID for simplicity
          x: point.x,
          y: point.y,
          layers: getConnectionPointLayers(point),
        })
      }
    })
  })

  for (const { obstacle, pcbPortId } of [...primitives].sort(
    (left, right) => left.primitiveKey.localeCompare(right.primitiveKey),
  )) {
    if (!pcbPortId || portMap.has(pcbPortId)) continue
    portMap.set(pcbPortId, {
      type: "pcb_port",
      pcb_port_id: pcbPortId,
      source_port_id: pcbPortId,
      x: obstacle.center.x,
      y: obstacle.center.y,
      layers: obstacle.layers,
    })
  }

  return Array.from(portMap.values())
}

function getConnectionAliases(
  connection: SimpleRouteJson["connections"][number],
): string[] {
  return [
    connection.name,
    connection.rootConnectionName,
    connection.netConnectionName,
    ...(connection.mergedConnectionNames ?? []),
    ...connection.pointsToConnect.flatMap((point) => [
      point.pointId,
      point.pcb_port_id,
    ]),
  ].filter((id): id is string => typeof id === "string")
}

function getReferencePadPrimitives(srj: SimpleRouteJson): PcbObstaclePrimitive[] {
  const primitives = getPcbObstaclePrimitives(srj.obstacles)
  const connectionAliases = new Set(
    srj.connections.flatMap(getConnectionAliases),
  )
  const reservedPortIds = new Set([
    ...srj.connections.flatMap((connection) =>
      connection.pointsToConnect.flatMap((point) =>
        point.pcb_port_id ? [point.pcb_port_id] : [],
      ),
    ),
    ...primitives.flatMap((primitive) =>
      primitive.pcbPortId ? [primitive.pcbPortId] : [],
    ),
  ])
  for (const primitive of [...primitives].sort(
    (left, right) => left.primitiveKey.localeCompare(right.primitiveKey),
  )) {
    if (
      primitive.pcbPortId ||
      !primitive.obstacle.connectedTo.some((alias) => connectionAliases.has(alias))
    ) continue
    const baseId = `pcb_port_${primitive.elementId}`
    let pcbPortId = baseId
    let suffix = 0
    while (reservedPortIds.has(pcbPortId)) {
      pcbPortId = `${baseId}_${suffix++}`
    }
    primitive.pcbPortId = pcbPortId
    reservedPortIds.add(pcbPortId)
  }
  return primitives
}

/**
 * Create pad-like circuit-json elements from SRJ obstacles.
 * Multi-layer obstacles represent plated holes and must not be deduped away
 * against top-side SMT pads that share the same connectivity metadata.
 */
function createPcbPadElements(
  primitives: PcbObstaclePrimitive[],
): AnyCircuitElement[] {
  const pads: AnyCircuitElement[] = []
  for (const { obstacle, elementId: id, pcbPortId } of primitives) {
    const layers = obstacle.layers

    const width = obstacle.width
    const height = obstacle.height
    const x = obstacle.center.x
    const y = obstacle.center.y

    const isMultiLayerObstacle = layers.length > 1

    if (isMultiLayerObstacle) {
      const isCircularLike = Math.abs(width - height) < 0.001

      if (isCircularLike) {
        pads.push({
          type: "pcb_plated_hole",
          pcb_plated_hole_id: id,
          shape: "circle",
          outer_diameter: Math.max(width, height),
          hole_diameter: Math.max(Math.min(width, height) * 0.5, 0.1),
          x,
          y,
          layers,
          ...(pcbPortId ? { pcb_port_id: pcbPortId } : {}),
        } as any)
        continue
      }

      pads.push({
        type: "pcb_plated_hole",
        pcb_plated_hole_id: id,
        shape: "circular_hole_with_rect_pad",
        hole_shape: "circle",
        hole_diameter: Math.max(Math.min(width, height) * 0.5, 0.1),
        rect_pad_width: width,
        rect_pad_height: height,
        hole_offset_x: 0,
        hole_offset_y: 0,
        x,
        y,
        layers,
        ...(pcbPortId ? { pcb_port_id: pcbPortId } : {}),
      } as any)
      continue
    }

    pads.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: id,
      layer: layers[0],
      shape: "rect",
      width,
      height,
      x,
      y,
      ...(pcbPortId ? { pcb_port_id: pcbPortId } : {}),
    } as any)
  }

  return pads
}

/**
 * Extract vias from routes and convert them to pcb_via objects
 * @param routes The routes to extract vias from
 * @param minViaDiameter Default diameter for vias
 * @returns An array of PcbVia elements
 */
function extractViasFromRoutes(
  routes: SimplifiedPcbTrace[] | HighDensityRoute[],
  minViaDiameter = 0.3,
): PcbVia[] {
  const vias: PcbVia[] = []
  const viaLocations = new Set<string>() // Track unique via locations

  if (routes.length > 0) {
    if ("type" in routes[0] && routes[0].type === "pcb_trace") {
      // Extract vias from SimplifiedPcbTraces
      ;(routes as SimplifiedPcbTrace[]).forEach((trace) => {
        trace.route.forEach((segment) => {
          if (segment.route_type === "via") {
            const viaDiameter = segment.via_diameter ?? minViaDiameter
            const locationKey = `${segment.x},${segment.y},${segment.from_layer},${segment.to_layer}`
            if (!viaLocations.has(locationKey)) {
              vias.push({
                type: "pcb_via",
                pcb_via_id: `via_${vias.length}`,
                pcb_trace_id: trace.pcb_trace_id,
                x: segment.x,
                y: segment.y,
                outer_diameter: viaDiameter,
                hole_diameter: viaDiameter * 0.5,
                layers: [segment.from_layer, segment.to_layer] as LayerName[],
              })
              viaLocations.add(locationKey)
            }
          }
        })
      })
    } else {
      // Extract vias from HighDensityRoutes by looking for layer changes
      ;(routes as HighDensityRoute[]).forEach((route, routeIndex) => {
        const traceId = `trace_${routeIndex}`
        const viaDiameter = route.viaDiameter ?? minViaDiameter
        for (let i = 1; i < route.route.length; i++) {
          const prevPoint = route.route[i - 1]
          const currPoint = route.route[i]

          // If z-coordinate changes, we have a via
          if (
            prevPoint.z !== currPoint.z &&
            Math.abs(prevPoint.x - currPoint.x) < 0.01 &&
            Math.abs(prevPoint.y - currPoint.y) < 0.01
          ) {
            const fromLayer = mapZToLayerName(prevPoint.z, 2)
            const toLayer = mapZToLayerName(currPoint.z, 2)
            const locationKey = `${currPoint.x},${currPoint.y},${fromLayer},${toLayer}`

            if (!viaLocations.has(locationKey)) {
              vias.push({
                type: "pcb_via",
                pcb_via_id: `via_${vias.length}`,
                pcb_trace_id: traceId,
                x: currPoint.x,
                y: currPoint.y,
                outer_diameter: viaDiameter,
                hole_diameter: viaDiameter * 0.5,
                layers: [fromLayer, toLayer] as LayerName[],
              })
              viaLocations.add(locationKey)
            }
          }
        }
      })
    }
  }

  return vias
}

/**
 * Convert the autorouter output to circuit-json format
 * @param srjWithPointPairs The SimpleRouteJson created by the NetToPointPairsSolver
 * @param routes The SimplifiedPcbTraces or HighDensityRoutes to convert
 * @param minTraceWidth Default width for traces if not specified
 * @param minViaDiameter Default diameter for vias if not specified
 */
export function convertToCircuitJson(
  srjWithPointPairs: SimpleRouteJson,
  routes: SimplifiedPcbTrace[] | HighDensityRoute[],
  minTraceWidth = 0.1,
  minViaDiameter = srjWithPointPairs.minViaDiameter ?? 0.3,
): AnyCircuitElement[] {
  // Start with empty circuit JSON
  const circuitJson: AnyCircuitElement[] = []
  const primitives = getReferencePadPrimitives(srjWithPointPairs)

  // Add source traces from connection information
  circuitJson.push(...createSourceTraces(srjWithPointPairs, primitives))

  // Add PCB ports for connection points
  circuitJson.push(...createPcbPorts(srjWithPointPairs, primitives))

  // Add PCB pads / plated holes represented by SRJ obstacles
  circuitJson.push(...createPcbPadElements(primitives))

  // Extract and add vias as independent pcb_via elements
  circuitJson.push(...extractViasFromRoutes(routes, minViaDiameter))

  // Build a map of connection names to simplify lookups
  const connectionMap = new Map<string, string>()
  srjWithPointPairs.connections.forEach((conn) => {
    connectionMap.set(
      conn.name,
      conn.netConnectionName || conn.rootConnectionName || conn.name,
    )
  })

  // Process routes based on their type
  if (routes.length > 0) {
    if ("type" in routes[0] && routes[0].type === "pcb_trace") {
      // Handle SimplifiedPcbTraces
      ;(routes as SimplifiedPcbTrace[]).forEach((trace) => {
        const connectionName = trace.connection_name
        circuitJson.push(
          convertSimplifiedPcbTraceToCircuitJson(
            trace,
            connectionMap.get(connectionName) || connectionName,
          ) as AnyCircuitElement,
        )
      })
    } else {
      // Handle HighDensityRoutes - may produce multiple traces per route if jumpers exist
      ;(routes as HighDensityRoute[]).forEach((route, index) => {
        const connectionName = route.connectionName
        const traces = convertHdRouteToCircuitJsonTraces(
          route,
          `trace_${index}`,
          connectionMap.get(connectionName) || connectionName,
          minTraceWidth,
        )
        circuitJson.push(...(traces as AnyCircuitElement[]))
      })
    }
  }

  return circuitJson
}
