# Incomplete coupled-repair investigation

`trace-pad-local-contact-repair.test.ts` is an intentionally failing reproduction
of targeted pad repulsion making clearance to a neighboring trace worse. It is
not a finished regression/fix. Run it explicitly with Bun when investigating.
Run the existing normal suite via `bun test ./tests --timeout 9999999` so this
archived reproduction is not mistaken for a new production-suite regression.

The attempted localized movement was reverted. The production branch contains
only the verified clearance and severity fixes. Full context and commands:
https://github.com/joegoldin/tscircuit-autorouter/blob/jlcpcb-clearance/docs/CONTINUE_ROUTER_CLEARANCE.md
