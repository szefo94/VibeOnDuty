import { Color } from 'three';

// Metadata is an allowlist: an untagged material never becomes a team accent.
export function characterDomain(node, material) {
  return material?.userData?.artDomain ?? node?.userData?.artDomain ??
    node?.parent?.userData?.artDomain;
}

const appearances = new WeakMap();

export function applyCharacterAppearance(root) {
  if (!root || appearances.has(root)) return;
  const accents = new Map();
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const assign = (material) => {
      if (!material || !['team-accent', 'teamAccent'].includes(characterDomain(node, material)))
        return material;
      let entry = accents.get(material);
      if (!entry) {
        const owned = material.clone();
        owned.userData.characterOwned = true;
        entry = { owned, color: material.color?.clone(), emissive: material.emissive?.clone(),
          intensity: material.emissiveIntensity };
        accents.set(material, entry);
      }
      return entry.owned;
    };
    node.material = Array.isArray(node.material) ? node.material.map(assign) : assign(node.material);
  });
  appearances.set(root, accents);
}

export function tintCharacterAccents(root, hexColor) {
  if (!root) return;
  applyCharacterAppearance(root);
  const color = hexColor == null ? null : new Color(hexColor);
  for (const { owned, color: base, emissive, intensity } of appearances.get(root).values()) {
    if (owned.color && base) owned.color.copy(color ?? base);
    // Leave painted light response intact; tint does not add an emissive body glow.
    if (owned.emissive && emissive) owned.emissive.copy(emissive);
    owned.emissiveIntensity = intensity;
  }
}
