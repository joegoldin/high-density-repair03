import { expect, test } from "bun:test"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  AutoroutingDrcEngine,
  GlobalDrcBranchPortfolioSolver,
  type HighDensityRoute,
  type SimpleRouteJson,
} from "../lib"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"

test("cleans up a same-net via overlap introduced by coupled broad repair", () => {
  const routes: HighDensityRoute[] = [
    {
      connectionName: "signal",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      vias: [{ x: 4.715, y: 1.1150015582258574 }],
      route: [
        { x: 4.606008672429025, y: 1.0976906346250164, z: 1 },
        { x: 4.715, y: 1.1150015582258574, z: 1 },
        { x: 4.715, y: 1.1150015582258574, z: 0 },
        { x: 4.683, y: 1.3362447261667765, z: 0 },
        { x: 4.35452350371261, y: 1.6585191253289255, z: 0 },
        { x: 4.048305520726764, y: 1.821932813056818, z: 0 },
        { x: 3.7817407643681795, y: 1.081024653748314, z: 0 },
        { x: 3.7950027854124384, y: 1.055365525905887, z: 0 },
        { x: 3.8, y: 0.95, z: 0 },
      ],
    },
    {
      connectionName: "rail",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      vias: [],
      route: [
        { x: 3.4, y: 0.95, z: 0 },
        { x: 3.3591781896862023, y: 1.3922735551067384, z: 0 },
        { x: 3.9477774397881524, y: 2.1834470478036017, z: 0 },
      ],
    },
    {
      connectionName: "shared_mst0",
      rootConnectionName: "shared",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      vias: [{ x: 2.8, y: 2.5 }],
      route: [
        { x: 2.5, y: 2.5, z: 0 },
        { x: 2.8, y: 2.5, z: 0 },
        { x: 2.8, y: 2.5, z: 1 },
      ],
    },
    {
      connectionName: "shared_mst1",
      rootConnectionName: "shared",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      vias: [{ x: 2.85, y: 2.5 }],
      route: [
        { x: 2.85, y: 2.5, z: 0 },
        { x: 2.85, y: 2.5, z: 1 },
        { x: 3.15, y: 2.5, z: 1 },
      ],
    },
  ]
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: 2, maxX: 5, minY: 0, maxY: 3 },
    obstacles: [3.4, 3.8, 4.2].map((x, index) => ({
      type: "rect",
      center: { x, y: 0.95 },
      width: 0.2,
      height: 0.85,
      layers: ["top"],
      connectedTo: [
        `pcb_smtpad_${index}`,
        ...(index === 1 ? ["signal"] : index === 0 ? ["rail"] : []),
      ],
    })),
    connections: routes.map((route) => ({
      name: route.connectionName,
      pointsToConnect: [route.route[0]!, route.route.at(-1)!].map((point) => ({
        ...point,
        layer: point.z === 0 ? "top" : "bottom",
      })),
    })),
  }
  const connMap = new ConnectivityMap({})
  connMap.addConnections([
    ["shared_mst0", "shared"],
    ["shared_mst1", "shared"],
  ])
  const engine = new AutoroutingDrcEngine(srj, {
    connMap,
    traceClearance: 0.15,
    viaClearance: 0.15,
  })
  const evaluator = ({
    routes: candidateRoutes = [],
  }: {
    routes?: HighDensityRoute[]
  }) => {
    const primarySnapshot = getDrcSnapshot(
      srj,
      candidateRoutes.filter(({ connectionName }) =>
        ["signal", "rail"].includes(connectionName),
      ),
      undefined,
      connMap,
      engine,
    )
    if (primarySnapshot.count > 0) {
      return [
        ...primarySnapshot.errors,
        ...primarySnapshot.errors.map((error) => ({
          ...error,
          pcb_error_id: `duplicate_${String(error.pcb_error_id)}`,
        })),
      ]
    }

    const leftVia = candidateRoutes.find(
      ({ connectionName }) => connectionName === "shared_mst0",
    )!.vias[0]!
    const rightVia = candidateRoutes.find(
      ({ connectionName }) => connectionName === "shared_mst1",
    )!.vias[0]!
    if (leftVia.x === rightVia.x && leftVia.y === rightVia.y) return []

    return [
      {
        type: "pcb_via_clearance_error",
        error_type: "pcb_via_clearance_error",
        pcb_error_id: "same_net_vias_close_via_0_via_1",
        pcb_via_ids: ["via_0", "via_1"],
        pcb_via_pair_net_relation: "same_net",
        center: {
          x: (leftVia.x + rightVia.x) / 2,
          y: (leftVia.y + rightVia.y) / 2,
        },
      },
    ]
  }
  const solver = new GlobalDrcBranchPortfolioSolver({
    srj,
    hdRoutes: routes,
    connMap,
    drcEvaluator: evaluator,
    maxIterations: 1,
    enableBroadFallback: false,
    enableLargeBoardBroadFallback: false,
    enableTargetedErrorSweep: true,
    enablePostSolveClearanceRelaxation: false,
    enableSafeTraceLayerMoves: false,
    enableViaInPadLayerMoves: false,
    broadMaxIterations: 1,
    broadPassMultiplier: 1,
    coupledBroadPassMultipliers: [1, 2],
  })

  solver.solve()

  const output = solver.getOutput()
  const finalErrors = evaluator({ routes: output })
  const leftVia = output.find(
    ({ connectionName }) => connectionName === "shared_mst0",
  )!.vias[0]!
  const rightVia = output.find(
    ({ connectionName }) => connectionName === "shared_mst1",
  )!.vias[0]!
  expect(solver.stats.drcBranchPortfolioCoupledBroadPhaseAccepted).toBe(true)
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadSameNetViaCleanupAttempted,
  ).toBe(true)
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadSameNetViaCleanupAccepted,
  ).toBe(true)
  expect(finalErrors).toHaveLength(0)
  expect(rightVia).toEqual(leftVia)
})
