import { expect, test } from "bun:test"
import { AutoroutingDrcEngine } from "../lib"
import { getDrcErrors } from "../lib/solvers/GlobalDrcForceImproveSolver/getDrcErrors"
import { convertToCircuitJson } from "../lib/utils/convertToCircuitJson"
import {
  createAliasedPadFixture,
  createPadCrossingTrace,
  getCompiledObstacles,
  getCompiledPrimitiveSet,
} from "./fixtures/obstacle-primitives"

test("retains distinct pad primitives independently of expanded alias order", (): void => {
  for (const metadata of [true, false]) {
    const input = createAliasedPadFixture()
    if (!metadata) {
      for (const obstacle of input.obstacles) delete obstacle.circuitJsonMetadata
    }
    const baselineSets: string[][] = []
    const referenceSets: string[][] = []
    for (const reversed of [false, true]) {
      const srj = structuredClone(input)
      if (reversed) {
        srj.obstacles.reverse()
        for (const obstacle of srj.obstacles) obstacle.connectedTo.reverse()
      }
      const original = structuredClone(srj)
      const traces = createPadCrossingTrace()
      const engine = new AutoroutingDrcEngine(srj)
      expect(engine.evaluate(traces).errors).toHaveLength(1)
      const geometry = getCompiledObstacles(engine)
        .map(({ x, y, width, height, layers }) => ({ x, y, width, height, layers }))
        .sort((a, b) => a.x - b.x)
      expect(geometry).toEqual([
        { x: -1, y: 0, width: 0.4, height: 0.4, layers: ["top"] },
        { x: 1, y: 0, width: 0.4, height: 0.4, layers: ["top"] },
      ])
      if (metadata) {
        expect(
          getCompiledObstacles(engine).find((obstacle) => obstacle.x === 1)!.obstacleId,
        ).toBe("pcb_smtpad_1")
      }
      const circuit = convertToCircuitJson(srj, traces)
      const pads = circuit.filter((element) => element.type === "pcb_smtpad")
      expect(pads).toHaveLength(2)
      expect(new Set(pads.map((pad) => pad.pcb_smtpad_id)).size).toBe(2)
      expect(getDrcErrors(circuit, { traceClearance: 0.1 }).errors).toHaveLength(1)
      baselineSets.push(getCompiledPrimitiveSet(engine))
      referenceSets.push(pads.map((pad) => JSON.stringify(pad)).sort())
      expect(engine.evaluate(createPadCrossingTrace("foreign")).errors).toEqual([])
      expect(getDrcErrors(
        convertToCircuitJson(srj, createPadCrossingTrace("foreign")),
        { traceClearance: 0.1 },
      ).errors).toEqual([])
      expect(srj).toEqual(original)
    }
    expect(baselineSets[0]).toEqual(baselineSets[1]!)
    expect(referenceSets[0]).toEqual(referenceSets[1]!)
  }
})
