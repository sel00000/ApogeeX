import { A as e, C as t, F as n, H as r, I as i, L as a, M as ee, O as o, R as s, S as c, W as l, _ as te, c as ne, d as re, f as ie, g as u, h as ae, i as oe, o as d, p as se, r as ce, s as f, t as le, u as ue, v as de, w as p, y as fe, z as pe } from "./three-_90hMHc0.js";
// home-src/sky-scan.js
var m = Math.PI / 180, h = (e, t) => new l(Math.cos(t * m) * Math.cos(e * m), Math.cos(t * m) * Math.sin(e * m), Math.sin(t * m)), me = h(174.2044, -6.003), g = h(96.384, 29.8114), _ = 3.5, he = .2, v = 17, y = 10.9, b = 40, ge = 60;
function x(x, { skyUrl: _e, craftUrl: ve, starsUrl: ye } = {}) {
	let S = new ce({
		canvas: x,
		antialias: !0,
		alpha: !1,
		powerPreference: "high-performance"
	}), C = Math.min(devicePixelRatio || 1, 1.4);
	S.setPixelRatio(C), S.setClearColor(329482), S.outputColorSpace = i;
	let w = new a(), T = new o(27, 1, .01, 200), E = me.clone(), D = g.clone().sub(E.clone().multiplyScalar(E.dot(g))).normalize(), O = new l().crossVectors(E, D).normalize(), k = new l().crossVectors(E, g).normalize(), A = new s({
		side: 1,
		depthWrite: !1,
		uniforms: {
			map: { value: null },
			gain: { value: 0 }
		},
		vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
		fragmentShader: "uniform sampler2D map; uniform float gain; varying vec3 vDir;\nvoid main(){ vec3 d = normalize(vDir); float l = atan(d.y, d.x), b = asin(clamp(d.z,-1.,1.));\n  vec3 col = texture2D(map, vec2(fract(0.5 - l / 6.28318530718), 0.5 + b / 3.14159265359)).rgb;\n  gl_FragColor = vec4(col * gain, 1.0);\n  #include <colorspace_fragment>\n}"
	}), be = new t(new pe(ge, 96, 48), A);
	be.renderOrder = -10, w.add(be), new r().load(_e, (e) => {
		e.colorSpace = i, e.wrapS = n, e.generateMipmaps = !1, e.minFilter = e.magFilter = fe, A.uniforms.map.value = e, A.uniforms.gain.value = .34, Y();
	}), ye && fetch(ye).then((e) => {
		if (!e.ok) throw Error(e.status);
		return e.arrayBuffer();
	}).then((e) => {
		let t = new Float32Array(e), n = t.length / 4, r = new Float32Array(n * 3), i = new Float32Array(n), a = new Float32Array(n);
		for (let e = 0; e < n; e++) {
			let n = h(t[4 * e], t[4 * e + 1]).multiplyScalar(ge * .98);
			r.set([
				n.x,
				n.y,
				n.z
			], 3 * e), i[e] = t[4 * e + 2], a[e] = Number.isFinite(t[4 * e + 3]) ? t[4 * e + 3] : .6;
		}
		let o = new f().setAttribute("position", new d(r, 3)).setAttribute("mag", new d(i, 1)).setAttribute("bv", new d(a, 1)), c = new ee(o, new s({
			transparent: !0,
			depthWrite: !1,
			blending: 2,
			uniforms: { pr: { value: S.getPixelRatio() } },
			vertexShader: "attribute float mag; attribute float bv; uniform float pr; varying float vA; varying vec3 vC;\nvoid main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  float L = pow(10.0, -0.4 * (mag - 7.0));            // brightness relative to a V = 7 star\n  gl_PointSize = clamp(1.3 + 0.9 * log(L), 1.3, 7.0) * pr;\n  vA = clamp(0.32 + 0.12 * log(L), 0.32, 1.0);\n  float t = clamp((bv + 0.2) / 1.8, 0.0, 1.0);          // B−V → a faint warm/cool tint\n  vC = mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.88, 0.74), t); }",
			fragmentShader: "varying float vA; varying vec3 vC;\nvoid main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC * a * vA, 1.0); }"
		}));
		c.renderOrder = -9, c.frustumCulled = !1, w.add(c), Y();
	}).catch(() => {}), w.add(new se(13621478, 724240, .35));
	let xe = new ue(16774374, 2.6);
	xe.position.copy(k).multiplyScalar(10), w.add(xe);
	let j = E.clone().multiplyScalar(.5).add(O.clone().multiplyScalar(.86)).normalize().multiplyScalar(1.24), M = new ie();
	M.position.copy(j), w.add(M);
	let N = E.clone();
	{
		let e = k.clone().sub(N.clone().multiplyScalar(k.dot(N))).normalize().negate(), t = new l().crossVectors(N, e);
		M.quaternion.setFromRotationMatrix(new c().makeBasis(t, N, e));
	}
	let Se = Promise.resolve();
	ve && (Se = new le().loadAsync(ve).then((e) => {
		let t = new oe().setFromObject(e.scene), n = t.getSize(new l()), r = t.getCenter(new l()), i = .11 / Math.max(n.x, n.y, n.z);
		return e.scene.scale.setScalar(i), e.scene.position.copy(r).multiplyScalar(-i), M.add(e.scene), S.compileAsync ? S.compileAsync(w, T).catch(() => {}) : null;
	}).then(() => Y()).catch(() => {}));
	let P = j.clone().add(E.clone().multiplyScalar(-.9)).add(D.clone().multiplyScalar(.24)).add(O.clone().multiplyScalar(-.02));
	T.position.copy(P), T.up.copy(O);
	let F = {
		yaw: 0,
		pitch: 0,
		yawT: 0,
		pitchT: 0,
		follow: 0
	};
	function Ce() {
		let e = U(F.follow).centre.multiplyScalar(b).add(O.clone().multiplyScalar(b * .02)).add(D.clone().multiplyScalar(-40 * .07)).clone().sub(P).normalize();
		e.applyAxisAngle(O, F.yaw).applyAxisAngle(new l().crossVectors(e, O).normalize(), F.pitch), T.lookAt(P.clone().add(e));
	}
	let we = (() => {
		let e = document.createElement("canvas");
		e.width = 1024, e.height = 96;
		let t = e.getContext("2d"), n = e.width * _ / y, r = e.width * he / y;
		for (let i = 0; i < 3; i++) {
			let a = i * (n + r);
			for (let r = 0; r < v; r++) {
				let i = r / 16;
				t.fillStyle = `rgba(${Math.round(244 - 20 * i)},${Math.round(236 - 72 * i)},${Math.round(222 - 134 * i)},${.16 + .34 * i})`, t.fillRect(a + r * n / v, 0, n / v - 1.2, e.height);
			}
			t.strokeStyle = "rgba(255,255,255,.8)", t.lineWidth = 2, t.strokeRect(a + 1, 1, n - 2, e.height - 2);
		}
		let a = new ne(e);
		return a.colorSpace = i, a.anisotropy = 4, a;
	})(), I = 80 * Math.tan(y / 2 * m), L = 80 * Math.tan(_ / 2 * m), R = new t(new e(I, L), new p({
		map: we,
		transparent: !0,
		depthWrite: !1,
		side: 2
	}));
	R.renderOrder = 2, w.add(R);
	let z = new p({
		color: 15912811,
		transparent: !0,
		opacity: 0,
		depthWrite: !1,
		side: 2,
		blending: 2
	}), B = new t(new e(I, L), z);
	B.renderOrder = 3, w.add(B);
	let Te = _ / y * I / v, Ee = z.clone(), V = new t(new e(Te, L), Ee);
	V.renderOrder = 3, w.add(V);
	let H = (e) => {
		let t = Math.floor(e / v), n = e % v;
		return t * 3.7 + (n + .5) * _ / v - y / 2;
	}, U = (e) => {
		let t = -e * m;
		return {
			centre: E.clone().multiplyScalar(Math.cos(t)).add(D.clone().multiplyScalar(Math.sin(t))),
			along: D.clone().multiplyScalar(Math.cos(t)).sub(E.clone().multiplyScalar(Math.sin(t)))
		};
	}, W = (e, t, n = 0) => {
		let { centre: r, along: i } = U(t);
		e.position.copy(r).multiplyScalar(b).add(i.clone().multiplyScalar(n)), e.quaternion.setFromRotationMatrix(new c().makeBasis(i, O, r));
	}, De = (e) => {
		let { centre: t, along: n } = U(e), r = t.clone().multiplyScalar(b);
		return [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		].map(([e, t]) => r.clone().add(n.clone().multiplyScalar(e * I / 2)).add(O.clone().multiplyScalar(t * L / 2)));
	}, Oe = Array.from({ length: 51 }, (e, t) => {
		let n = new te(new f().setFromPoints(De(H(t))), new u({
			color: 15320207,
			transparent: !0,
			opacity: 0
		}));
		return n.visible = !1, w.add(n), n;
	});
	{
		let e = [];
		for (let t = -70; t <= 70; t += 1) e.push(U(t).centre.multiplyScalar(b * 1.001));
		w.add(new ae(new f().setFromPoints(e), new u({
			color: 15320207,
			transparent: !0,
			opacity: .22
		})));
	}
	let ke = b * Math.tan(.07 * m) * 1.6, Ae = E.clone().multiplyScalar(b * .999), je = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([e, t]) => Ae.clone().add(D.clone().multiplyScalar(e * ke)).add(O.clone().multiplyScalar(t * ke))), Me = new te(new f().setFromPoints(je), new u({ color: 15912811 }));
	Me.renderOrder = 5, w.add(Me);
	let G = new de(new f().setAttribute("position", new re(/* @__PURE__ */ new Float32Array(24), 3)), new u({
		color: 16051422,
		transparent: !0,
		opacity: .32
	})), K = new t(new f().setAttribute("position", new re(/* @__PURE__ */ new Float32Array(36), 3)), new p({
		color: 16051422,
		transparent: !0,
		opacity: .045,
		depthWrite: !1,
		side: 2
	}));
	w.add(G, K);
	let q = j.clone().add(N.clone().multiplyScalar(.08)), J = !0;
	function Y() {
		J = !0;
	}
	function X() {
		let e = x.getBoundingClientRect();
		e.width && (S.setSize(e.width, e.height, !1), T.aspect = e.width / e.height, T.updateProjectionMatrix(), J = !0);
	}
	let Ne = new ResizeObserver(X);
	Ne.observe(x), X();
	let Pe = "", Z = 0, Q = 0, $ = 0;
	function Fe() {
		let e = performance.now(), t = Z ? (e - Z) / 1e3 : 0;
		if (Z = e, !(t > 0 && t < .25) || (Q += t, $++, Q < 1.5)) return;
		let n = Q / $;
		Q = $ = 0, n > 1 / 48 && C > 1 && (C = Math.max(1, C - .2), S.setPixelRatio(C), X());
	}
	function Ie(e) {
		Fe();
		let t = H(e.prev) + (H(e.step) - H(e.prev)) * e.k;
		F.follow += (t * .55 - F.follow) * .06, F.yaw += (F.yawT - F.yaw) * .12, F.pitch += (F.pitchT - F.pitch) * .12;
		let n = Math.abs(F.follow - t * .55) > .01 || Math.abs(F.yawT - F.yaw) > 1e-4 || Math.abs(F.pitchT - F.pitch) > 1e-4, r = JSON.stringify(e);
		if (r === Pe && !J && !n) return;
		Pe = r, J = !1, Ce();
		let i = H(e.prev) + (H(e.step) - H(e.prev)) * e.k;
		W(R, i), W(B, i);
		let a = Math.floor(e.step / v), ee = e.step % v, o = (a * 3.7 + (ee + .5) * _ / v - y / 2) / y * I;
		W(V, i, o), R.material.opacity = e.fade, z.opacity = e.flashAll ? .5 * e.flash : 0, Ee.opacity = e.flashAll ? 0 : .75 * e.flash, Oe.forEach((t, n) => {
			t.visible = n < e.upto && e.fade > .01, t.material.opacity = Math.max(.05, .42 * (1 - (e.upto - n) / 18)) * e.fade;
		});
		let s = De(i), c = G.geometry.attributes.position, l = K.geometry.attributes.position;
		s.forEach((e, t) => {
			c.setXYZ(2 * t, q.x, q.y, q.z), c.setXYZ(2 * t + 1, e.x, e.y, e.z);
		}), [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0]
		].forEach(([e, t], n) => {
			l.setXYZ(3 * n, q.x, q.y, q.z), l.setXYZ(3 * n + 1, s[e].x, s[e].y, s[e].z), l.setXYZ(3 * n + 2, s[t].x, s[t].y, s[t].z);
		}), c.needsUpdate = l.needsUpdate = !0, G.material.opacity = .32 * e.fade, K.material.opacity = .045 * e.fade, S.render(w, T);
	}
	function Le() {
		let e = x.getBoundingClientRect();
		return je.map((t) => {
			let n = t.clone().project(T);
			return {
				x: (n.x + 1) / 2 * e.width,
				y: (1 - n.y) / 2 * e.height
			};
		});
	}
	function Re(e, t) {
		F.yawT = Math.max(-.5, Math.min(.5, F.yawT + e)), F.pitchT = Math.max(-.3, Math.min(.3, F.pitchT + t)), J = !0;
	}
	function ze() {
		F.yawT = 0, F.pitchT = 0, J = !0;
	}
	return {
		draw: Ie,
		project: Le,
		ready: Se,
		invalidate: Y,
		look: Re,
		release: ze,
		dispose() {
			Ne.disconnect(), S.dispose();
		}
	};
}
export { x as mountSkyScan };
