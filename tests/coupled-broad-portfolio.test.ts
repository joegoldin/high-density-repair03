import { expect, test } from "bun:test"
import {
  AutoroutingDrcEngine,
  GlobalDrcBranchPortfolioSolver,
  type HighDensityRoute,
  type SimpleRouteJson,
} from "../lib"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"

test("rejects invalid coupled broad pass multipliers", () => {
  const params = {
    srj: {
      layerCount: 2,
      minTraceWidth: 0.15,
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      obstacles: [],
      connections: [],
    },
    hdRoutes: [],
    broadMaxIterations: 1,
    broadPassMultiplier: 1,
  } satisfies Omit<
    ConstructorParameters<typeof GlobalDrcBranchPortfolioSolver>[0],
    "coupledBroadPassMultipliers"
  >

  expect(
    () =>
      new GlobalDrcBranchPortfolioSolver({
        ...params,
        coupledBroadPassMultipliers: [Number.NaN],
      }),
  ).toThrow("coupledBroadPassMultipliers must contain only finite numbers")
  expect(
    () =>
      new GlobalDrcBranchPortfolioSolver({
        ...params,
        coupledBroadPassMultipliers: [0],
      }),
  ).toThrow(
    "coupledBroadPassMultipliers must contain only numbers greater than zero",
  )
})

test("repairs a coupled trace-pad conflict with bounded broad candidates", () => {
  const signal: HighDensityRoute = {
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
  }
  const rail: HighDensityRoute = {
    connectionName: "rail",
    traceThickness: 0.15,
    viaDiameter: 0.5,
    vias: [],
    route: [
      { x: 3.4, y: 0.95, z: 0 },
      { x: 3.3591781896862023, y: 1.3922735551067384, z: 0 },
      { x: 3.9477774397881524, y: 2.1834470478036017, z: 0 },
    ],
  }
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
    connections: [signal, rail].map((route) => ({
      name: route.connectionName,
      pointsToConnect: [route.route[0]!, route.route.at(-1)!].map((point) => ({
        ...point,
        layer: point.z === 0 ? "top" : "bottom",
      })),
    })),
  }
  const engine = new AutoroutingDrcEngine(srj, {
    traceClearance: 0.15,
    viaClearance: 0.15,
  })
  const hdRoutes = [signal, rail]
  const inputJson = JSON.stringify(hdRoutes)
  const initialSnapshot = getDrcSnapshot(
    srj,
    hdRoutes,
    undefined,
    undefined,
    engine,
  )
  const solver = new GlobalDrcBranchPortfolioSolver({
    srj,
    hdRoutes,
    autoroutingDrcEngine: engine,
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
  const finalSnapshot = getDrcSnapshot(
    srj,
    output,
    undefined,
    undefined,
    engine,
  )
  expect(initialSnapshot.count).toBe(1)
  expect(finalSnapshot.count).toBe(0)
  expect(JSON.stringify(hdRoutes)).toBe(inputJson)
  expect(output.map(({ connectionName }) => connectionName)).toEqual([
    "signal",
    "rail",
  ])
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadAttemptedMultipliers,
  ).toEqual([1])
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadCandidateDrcIssueCounts,
  ).toEqual([0])
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadCandidateDrcIssueScores,
  ).toEqual([0])
  expect(solver.stats.drcBranchPortfolioCoupledBroadAcceptedMultiplier).toBe(1)
  expect(solver.stats.drcBranchPortfolioCoupledBroadPhaseAccepted).toBe(true)
  expect(solver.stats.drcBranchPortfolioBroadBranchAttempted).toBe(false)
  expect(
    output.map(({ connectionName, route, traceThickness, viaDiameter }) => ({
      connectionName,
      start: route[0],
      end: route.at(-1),
      traceThickness,
      viaDiameter,
    })),
  ).toEqual(
    hdRoutes.map(({ connectionName, route, traceThickness, viaDiameter }) => ({
      connectionName,
      start: route[0],
      end: route.at(-1),
      traceThickness,
      viaDiameter,
    })),
  )
})
