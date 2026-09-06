import type {
  AutoroutingDrcEngine,
  SimpleRouteJson,
  SimplifiedPcbTraces,
} from "../../lib"

export const createAliasedPadFixture = (): SimpleRouteJson => ({
  bounds: { minX: -3, minY: -3, maxX: 3, maxY: 3 },
  connections: [
    { name: "signal", pointsToConnect: [] },
    { name: "foreign", pointsToConnect: [] },
  ],
  obstacles: [-1, 1].map((x, index) => ({
    type: "rect" as const,
    obstacleId: `physical_${index}`,
    circuitJsonMetadata: { pcb_smtpad_id: `pcb_smtpad_${index}` },
    layers: ["top"],
    center: { x, y: 0 },
    width: 0.4,
    height: 0.4,
    connectedTo: ["pcb_smtpad_0", "pcb_smtpad_1", "foreign"],
  })),
  layerCount: 2,
  minTraceWidth: 0.1,
  minViaDiameter: 0.3,
})

export const createPadCrossingTrace = (
  connectionName = "signal",
): SimplifiedPcbTraces => [
  {
    type: "pcb_trace",
    pcb_trace_id: "trace_signal",
    connection_name: connectionName,
    route: [
      { route_type: "wire", x: 0.7, y: 0, width: 0.1, layer: "top" },
      { route_type: "wire", x: 1.3, y: 0, width: 0.1, layer: "top" },
    ],
  },
]

type CompiledObstacle = {
  obstacleId: string
  obstacleType: string
  connectedTo: string[]
  x: number
  y: number
  width: number
  height: number
  radius?: number
  layers: string[]
}

export const getCompiledObstacles = (
  engine: AutoroutingDrcEngine,
): CompiledObstacle[] =>
  (engine as unknown as { obstacles: CompiledObstacle[] }).obstacles

export const getCompiledPrimitiveSet = (
  engine: AutoroutingDrcEngine,
): string[] =>
  getCompiledObstacles(engine).map((obstacle) => JSON.stringify({
    owner: obstacle.obstacleId,
    type: obstacle.obstacleType,
    x: obstacle.x,
    y: obstacle.y,
    width: obstacle.width,
    height: obstacle.height,
    radius: obstacle.radius,
    layers: [...obstacle.layers].sort(),
    aliases: [...new Set(obstacle.connectedTo)].sort(),
  })).sort()
