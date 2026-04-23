/** @param {import('../../types/entities').EntityBase} obj */
export function applyEntityBase(obj) {
  obj.isAlive = () => !obj.dead;
  obj.takeDamage = (dmg, onDie) => {
    if (obj.dead) return;
    obj.hp = Math.max(0, obj.hp - dmg);
    if (obj.hp <= 0) onDie(obj);
  };
}
