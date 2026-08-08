/* 通用工具函数 */

export const rnd = (a: number, b: number) => a + Math.random() * (b - a)
export const ri = (a: number, b: number) => Math.floor(rnd(a, b + 1))
export const chance = (p: number) => Math.random() < p
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const choice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
export function fmtG(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
