import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'

test('render workload during real R Dra playback', async ({ page }) => {
  test.slow()
  await page.addInitScript(() => {
    const stats = { draws: 0, frames: 0 }
    ;(window as unknown as { renderStats: typeof stats }).renderStats = stats
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'] as const) {
        const p = proto as unknown as Record<string, (...args: unknown[]) => unknown>
        const old = p[key]; if (!old) continue
        p[key] = function(...args: unknown[]) { stats.draws++; return old.apply(this,args) }
      }
    }
  })
  await page.goto('/?target=r_dra')
  await expect(page.getByText('영상 불러오는 중…',{exact:true})).toHaveCount(0,{timeout:90_000})
  await page.getByLabel('SPHEREx 영상 겹치기',{exact:true}).check()
  await page.getByRole('button',{name:'▶ Blink',exact:true}).click()
  const stats = await page.evaluate(async () => {
    const s=(window as unknown as {renderStats:{draws:number}}).renderStats
    s.draws=0; const start=performance.now();const gaps:number[]=[];let last=start
    await new Promise<void>(resolve=>{const tick=(t:number)=>{gaps.push(t-last);last=t;if(t-start>=2500)resolve();else requestAnimationFrame(tick)};requestAnimationFrame(tick)})
    return {draws:s.draws,seconds:(performance.now()-start)/1000,frames:gaps.length,maxFrameMs:Math.max(...gaps),meanFrameMs:gaps.reduce((a,b)=>a+b,0)/gaps.length}
  })
  await page.getByRole('button',{name:'■ 정지',exact:true}).first().click()
  writeFileSync(`docs/audits/render-${process.env.PERF_PHASE??'latest'}.json`,JSON.stringify(stats,null,2))
  console.log('RENDER_METRICS',JSON.stringify(stats))
  expect(stats.draws).toBeGreaterThan(0)
})
