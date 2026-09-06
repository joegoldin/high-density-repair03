import { test } from "bun:test"
import type { HighDensityRoute, SimpleRouteJson } from "../lib"
import fixtures from "./fixtures/bounded-via-pad-real.json"
import { checkBoundedViaPadRepair } from "./fixtures/bounded-via-pad"

test("clears reduced bug49 via pad contact without overshooting into neighboring copper", (): void => {
  checkBoundedViaPadRepair(fixtures.bug49 as { srj: SimpleRouteJson; routes: HighDensityRoute[] }, 1)
})
