import {afterEach,expect,it,vi} from 'vitest'

afterEach(()=>{vi.unstubAllGlobals();vi.resetModules()})
it('keeps remote frame files inside the validated result directory',async()=>{
  vi.stubGlobal('window',{location:{search:''}})
  vi.stubGlobal('document',{baseURI:'https://owner.github.io/Apogee/analysis/'})
  const {frameUrl}=await import('./data')
  const root='https://api.example/prefix/api/observations/data/patches/x/'
  expect(frameUrl('x','frames/0.f32',root)).toBe(root+'frames/0.f32')
  for(const file of ['../../private.f32','%2e%2e/private.f32','https://evil.example/image.png','//evil.example/image.png','data:image/png;base64,AAAA','image.png?secret=x'])
    expect(()=>frameUrl('x',file,root),file).toThrow('경로')
  expect(frameUrl('x','0.png','/api/observations/data/patches/x/')).toBe('/api/observations/data/patches/x/0.png')
})
