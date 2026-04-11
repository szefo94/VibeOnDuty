export let hitMarkerT = 0;

export function spawnHitMarker() {
  hitMarkerT = 260;
  document.getElementById('xhair-dot').style.cssText =
    'background:#e74c3c;width:5px;height:5px;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)';
}

export function tickHitMarker(dt) {
  if (hitMarkerT <= 0) return;
  hitMarkerT -= dt * 1000;
  if (hitMarkerT <= 0) {
    document.getElementById('xhair-dot').style.cssText =
      'background:#fff;width:3px;height:3px;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)';
    ['xh-t', 'xh-b', 'xh-l', 'xh-r'].forEach(
      (id) => (document.getElementById(id).style.transform = '')
    );
  }
}
