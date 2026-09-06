import type { HighDensityRoute, SimpleRouteJson } from "../../lib"

export const createSharedViaPadFixture = (): {
  srj: SimpleRouteJson
  hdRoutes: HighDensityRoute[]
} => ({
  srj: {
    bounds: { minX: -3, minY: -3, maxX: 3, maxY: 3 },
    connections: [
      { name: "signal_mst0", rootConnectionName: "signal", pointsToConnect: [] },
      { name: "signal_mst1", rootConnectionName: "signal", pointsToConnect: [] },
      { name: "foreign", pointsToConnect: [] },
    ],
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 0.44, y: 0 },
        width: 0.4,
        height: 0.4,
        connectedTo: ["pcb_smtpad_foreign", "foreign"],
      },
    ],
    layerCount: 2,
    minTraceWidth: 0.15,
    minViaDiameter: 0.3,
    minViaEdgeToPadEdgeClearance: 0.1,
  },
  hdRoutes: [0, 1].map(
    (index): HighDensityRoute => ({
      connectionName: `signal_mst${index}`,
      rootConnectionName: "signal",
      route: [
        {
          x: -1,
          y: 1.5 + index * 0.2,
          z: index,
          pcb_port_id: `start_${index}`,
        },
        { x: 0, y: 0, z: index },
        { x: 0, y: 0, z: 1 - index },
        {
          x: -1,
          y: -1.5 - index * 0.2,
          z: 1 - index,
          pcb_port_id: `end_${index}`,
        },
      ],
      vias: [{ x: 0, y: 0 }],
      traceThickness: 0.15,
      viaDiameter: 0.3,
    }),
  ),
})
