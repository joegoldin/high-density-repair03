import { expect, test } from "bun:test"
import {
  GlobalDrcBranchPortfolioSolver,
  type DrcEvaluator,
  type HighDensityRoute,
  type SimpleRouteJson,
} from "../lib"

test("validates the coupled schedule and rejects a worse mixed DRC candidate", () => {
  const validationParams = {
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
        ...validationParams,
        coupledBroadPassMultipliers: [Number.NaN],
      }),
  ).toThrow("coupledBroadPassMultipliers must contain only finite numbers")
  expect(
    () =>
      new GlobalDrcBranchPortfolioSolver({
        ...validationParams,
        coupledBroadPassMultipliers: [0],
      }),
  ).toThrow(
    "coupledBroadPassMultipliers must contain only numbers greater than zero",
  )

  const hdRoutes: HighDensityRoute[] = ["A", "B"].map(
    (connectionName, index) => ({
      connectionName,
      route: [
        { x: 1, y: 5 + index * 0.02, z: 0 },
        { x: 3, y: 5 + index * 0.02, z: 0 },
        { x: 7, y: 5 + index * 0.02, z: 0 },
        { x: 9, y: 5 + index * 0.02, z: 0 },
      ],
      vias: [],
      traceThickness: 0.1,
      viaDiameter: 0.3,
    }),
  )
  const srj: SimpleRouteJson = {
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    connections: hdRoutes.map((route) => ({
      name: route.connectionName,
      pointsToConnect: [],
    })),
    obstacles: [],
    layerCount: 2,
    minTraceWidth: 0.1,
    minViaDiameter: 0.3,
  }
  const inputJson = JSON.stringify(hdRoutes)
  const legacyError = {
    type: "pcb_trace_error",
    message: "persistent legacy conflict",
    minimum_clearance: 1,
    actual_clearance: 0,
  }
  const firstViaPadError = {
    type: "pcb_pad_pad_clearance_error",
    message: "persistent via-to-pad conflict",
    pcb_via_ids: ["via_0"],
    minimum_clearance: 1,
    actual_clearance: 0,
  }
  const addedViaPadError = {
    ...firstViaPadError,
    message: "new via-to-pad conflict",
    pcb_via_ids: ["via_1"],
  }
  const drcEvaluator: DrcEvaluator = ({ routes }) =>
    JSON.stringify(routes) === inputJson
      ? [legacyError, firstViaPadError]
      : [legacyError, firstViaPadError, addedViaPadError]
  const solver = new GlobalDrcBranchPortfolioSolver({
    srj,
    hdRoutes,
    drcEvaluator,
    maxIterations: 1,
    enableBroadFallback: false,
    enableLargeBoardBroadFallback: false,
    enableTargetedErrorSweep: true,
    enablePostSolveClearanceRelaxation: false,
    enableSafeTraceLayerMoves: false,
    enableViaInPadLayerMoves: false,
    broadMaxIterations: 1,
    broadPassMultiplier: 1,
    coupledBroadPassMultipliers: [1],
  })

  solver.solve()

  expect(solver.stats.drcBranchPortfolioInitialDrcIssueCount).toBe(2)
  expect(
    solver.stats.drcBranchPortfolioCoupledBroadCandidateDrcIssueCounts,
  ).toEqual([3])
  expect(solver.stats.drcBranchPortfolioCoupledBroadPhaseAccepted).toBe(false)
  expect(solver.stats.finalDrcIssueCount).toBe(2)
  expect(JSON.stringify(solver.getOutput())).toBe(inputJson)
})
