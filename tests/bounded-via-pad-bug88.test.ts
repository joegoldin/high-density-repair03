import { test } from "bun:test"
import type { HighDensityRoute, SimpleRouteJson } from "../lib"
import fixtures from "./fixtures/bounded-via-pad-real.json"
import { checkBoundedViaPadRepair } from "./fixtures/bounded-via-pad"

test("clears reduced bug88 via pad contact without overshooting into neighboring copper", (): void => {
  checkBoundedViaPadRepair(fixtures.bug88 as { srj: SimpleRouteJson; routes: HighDensityRoute[] }, 2)
})
