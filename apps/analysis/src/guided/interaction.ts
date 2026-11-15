/** Scrubbing selects actual observations; no intermediate image or epoch is fabricated. */
export const clamp = (value:number,min:number,max:number) => Math.max(min,Math.min(max,value))
export const frameFromScrub = (value:number):0|1 => value<50?0:1
export function cropWindow(n:number,zoom:number,center:{x:number;y:number}) {
 const width=n/clamp(zoom,1,3)
 return {width,left:clamp(center.x-width/2,0,n-width),top:clamp(center.y-width/2,0,n-width)}
}
