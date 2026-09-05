import { expect, test } from "bun:test"
import {
  AutoroutingDrcEngine,
  GlobalDrcBranchPortfolioSolver,
  type HighDensityRoute,
  type SimpleRouteJson,
} from "../lib"
import { getDrcSnapshot } from "../lib/solvers/GlobalDrcForceImproveSolver/solverHelpers"

test("exhausts coupled broad candidates for an immovable terminal conflict", () => {
  const hdRoutes: HighDensityRoute[] = [
    {
      connectionName: "signal",
      traceThickness: 0.15,
      viaDiameter: 0.5,
      vias: [],
      route: [
        { x: 1, y: 1, z: 0 },
        { x: 3, y: 1, z: 0 },
      ],
    },
  ]
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    minTraceToPadEdgeClearance: 0.15,
    bounds: { minX: 0, maxX: 4, minY: 0, maxY: 2 },
    obstacles: [
      {
        type: "rect",
        center: { x: 1, y: 1 },
        width: 0.5,
        height: 0.5,
        layers: ["top"],
        connectedTo: ["foreign", "pcb_smtpad_foreign"],
      },
    ],
    connections: [
      {
        name: "signal",
        pointsToConnect: [
          { x: 1, y: 1, layer: "top" },
          { x: 3, y: 1, layer: "top" },
        ],
      },
    ],
  }
  const engine = new AutoroutingDrcEngine(srj, {
    traceClearance: 0.15,
    viaClearance: 0.15,
  })
  const inputJson = JSON.stringify(hdRoutes)
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
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(JSON.stringify(output)).toBe(inputJson)
  expect(JSON.stringify(hdRoutes)).toBe(inputJson)
  expect(finalSnapshot.count).toBeGreaterThan(0)
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadAttemptedMultipliers,
  ).toEqual([1, 2])
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadCandidateDrcIssueCounts,
  ).toHaveLength(2)
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadCandidateDrcIssueScores,
  ).toHaveLength(2)
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadAcceptedMultiplier,
  ).toBeUndefined()
  expect(solver.stats.drcBranchPortfolioCoupledBroadPhaseAccepted).toBe(false)
})
