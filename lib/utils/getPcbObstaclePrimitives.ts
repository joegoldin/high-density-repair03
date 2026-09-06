import type { Obstacle } from "../types"

export type PcbObstaclePrimitive = {
  obstacle: Obstacle
  primitiveKey: string
  obstacleType: "pcb_smtpad" | "pcb_plated_hole"
  publicId: string
  elementId: string
  pcbPortId?: string
}

export const getPcbObstaclePrimitives = (
  obstacles: Obstacle[],
): PcbObstaclePrimitive[] => {
  const primitives = new Map<string, PcbObstaclePrimitive>()
  for (const obstacle of obstacles) {
    if (obstacle.layers.length === 0) continue
    const aliases = [...new Set(obstacle.connectedTo)].sort()
    const metadata = obstacle.circuitJsonMetadata
    const smtPadId =
      metadata?.pcb_smtpad_id ??
      aliases.find((id) => id.startsWith("pcb_smtpad_"))
    const platedHoleId =
      metadata?.pcb_plated_hole_id ??
      aliases.find((id) => id.startsWith("pcb_plated_hole_"))
    const pcbPortId =
      metadata?.pcb_port_id ??
      aliases.find((id) => id.startsWith("pcb_port_"))
    if (!smtPadId && !platedHoleId && !pcbPortId) continue

    const obstacleType =
      obstacle.layers.length > 1 ? "pcb_plated_hole" : "pcb_smtpad"
    const publicId =
      (obstacleType === "pcb_plated_hole" ? platedHoleId : smtPadId) ??
      `${obstacleType}_${obstacle.center.x.toFixed(3)}_${obstacle.center.y.toFixed(3)}`
    const primitiveKey = JSON.stringify([
      obstacle.obstacleId ?? null,
      metadata?.pcb_smtpad_id ?? null,
      metadata?.pcb_plated_hole_id ?? null,
      metadata?.pcb_via_id ?? null,
      metadata?.pcb_port_id ?? null,
      obstacle.type,
      obstacleType,
      obstacle.center.x,
      obstacle.center.y,
      obstacle.width,
      obstacle.height,
      obstacle.ccwRotationDegrees ?? 0,
      [...obstacle.layers].sort(),
      aliases,
    ])
    if (primitives.has(primitiveKey)) continue
    primitives.set(primitiveKey, {
      obstacle,
      primitiveKey,
      obstacleType,
      publicId,
      elementId: publicId,
      pcbPortId,
    })
  }

  const byPublicId = new Map<string, PcbObstaclePrimitive[]>()
  for (const primitive of primitives.values()) {
    const group = byPublicId.get(primitive.publicId) ?? []
    group.push(primitive)
    byPublicId.set(primitive.publicId, group)
  }
  const reservedIds = new Set(byPublicId.keys())
  for (const publicId of [...byPublicId.keys()].sort()) {
    const group = byPublicId.get(publicId)!
    if (group.length === 1) continue
    group.sort((left, right) =>
      left.primitiveKey.localeCompare(right.primitiveKey),
    )
    let index = 0
    for (const primitive of group) {
      let elementId: string
      do {
        elementId = `${publicId}__primitive_${index++}`
      } while (reservedIds.has(elementId))
      primitive.elementId = elementId
      reservedIds.add(elementId)
    }
  }
  return [...primitives.values()]
}
