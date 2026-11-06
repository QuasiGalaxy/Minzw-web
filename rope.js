// Fixed-step, mass-weighted Verlet rope. Kept independent of the DOM for validation.
export class Rope {
  constructor(x, y, length, segments = 13) {
    this.anchor = { x, y };
    this.length = length;
    this.segmentLength = length / segments;
    this.points = Array.from({ length: segments + 1 }, (_, i) => ({ x: x + Math.sin(i / segments * Math.PI / 2) * 50, y: y + i * this.segmentLength * .99, px: x + Math.sin(i / segments * Math.PI / 2) * 50, py: y + i * this.segmentLength * .99 }));
    this.target = null;
  }
  get end() { return this.points[this.points.length - 1]; }
  settle() {
    this.points.forEach((p, i) => { p.x = p.px = this.anchor.x; p.y = p.py = this.anchor.y + this.segmentLength * i; });
  }
  impulse(x, y = 0) { this.end.px -= x; this.end.py -= y; }
  step() {
    const ps = this.points;
    for (let i = 1; i < ps.length; i++) {
      const p = ps[i], vx = (p.x - p.px) * .994, vy = (p.y - p.py) * .994;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + .145;
    }
    for (let pass = 0; pass < 22; pass++) {
      ps[0].x = this.anchor.x; ps[0].y = this.anchor.y;
      if (this.target) { this.end.x = this.target.x; this.end.y = this.target.y; }
      for (let i = 0; i < ps.length - 1; i++) {
        const a = ps[i], b = ps[i + 1], dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || .001;
        const error = (dist - this.segmentLength) / dist;
        const wa = i === 0 ? 0 : 1;
        const wb = i + 1 === ps.length - 1 ? (this.target ? 0 : .16) : 1;
        const total = wa + wb;
        if (!total) continue;
        a.x += dx * error * wa / total; a.y += dy * error * wa / total;
        b.x -= dx * error * wb / total; b.y -= dy * error * wb / total;
      }
    }
    if (this.target) { this.end.x = this.target.x; this.end.y = this.target.y; }
  }
  get energy() { return this.points.reduce((sum, p) => sum + (p.x-p.px)**2 + (p.y-p.py)**2, 0); }
  path() {
    const ps = this.points;
    let path = `M${ps[0].x.toFixed(2)},${ps[0].y.toFixed(2)}`;
    for (let i = 1; i < ps.length - 1; i++) path += ` Q${ps[i].x.toFixed(2)},${ps[i].y.toFixed(2)} ${((ps[i].x + ps[i+1].x)/2).toFixed(2)},${((ps[i].y + ps[i+1].y)/2).toFixed(2)}`;
    return path + ` L${this.end.x.toFixed(2)},${this.end.y.toFixed(2)}`;
  }
}
