import { B as e, C as t, D as n, E as r, L as i, N as a, O as o, P as s, S as c, T as l, U as u, V as d, W as f, a as p, b as m, f as h, i as g, j as _, k as v, l as y, m as b, n as x, p as S, r as C, t as w, u as T, x as E } from "./three-_90hMHc0.js";
// vendor/three/examples/jsm/controls/OrbitControls.js
var D = { type: "change" }, O = { type: "start" }, k = { type: "end" }, A = new s(), j = new v(), M = Math.cos(70 * E.DEG2RAD), N = new f(), P = 2 * Math.PI, F = {
	NONE: -1,
	ROTATE: 0,
	DOLLY: 1,
	PAN: 2,
	TOUCH_ROTATE: 3,
	TOUCH_PAN: 4,
	TOUCH_DOLLY_PAN: 5,
	TOUCH_DOLLY_ROTATE: 6
}, I = 1e-6, L = class extends y {
	constructor(t, n = null) {
		super(t, n), this.state = F.NONE, this.target = new f(), this.cursor = new f(), this.minDistance = 0, this.maxDistance = Infinity, this.minZoom = 0, this.maxZoom = Infinity, this.minTargetRadius = 0, this.maxTargetRadius = Infinity, this.minPolarAngle = 0, this.maxPolarAngle = Math.PI, this.minAzimuthAngle = -Infinity, this.maxAzimuthAngle = Infinity, this.enableDamping = !1, this.dampingFactor = .05, this.enableZoom = !0, this.zoomSpeed = 1, this.enableRotate = !0, this.rotateSpeed = 1, this.keyRotateSpeed = 1, this.enablePan = !0, this.panSpeed = 1, this.screenSpacePanning = !0, this.keyPanSpeed = 7, this.zoomToCursor = !1, this.autoRotate = !1, this.autoRotateSpeed = 2, this.keys = {
			LEFT: "ArrowLeft",
			UP: "ArrowUp",
			RIGHT: "ArrowRight",
			BOTTOM: "ArrowDown"
		}, this.mouseButtons = {
			LEFT: m.ROTATE,
			MIDDLE: m.DOLLY,
			RIGHT: m.PAN
		}, this.touches = {
			ONE: d.ROTATE,
			TWO: d.DOLLY_PAN
		}, this.target0 = this.target.clone(), this.position0 = this.object.position.clone(), this.zoom0 = this.object.zoom, this._domElementKeyEvents = null, this._lastPosition = new f(), this._lastQuaternion = new a(), this._lastTargetPosition = new f(), this._quat = new a().setFromUnitVectors(t.up, new f(0, 1, 0)), this._quatInverse = this._quat.clone().invert(), this._spherical = new e(), this._sphericalDelta = new e(), this._scale = 1, this._panOffset = new f(), this._rotateStart = new u(), this._rotateEnd = new u(), this._rotateDelta = new u(), this._panStart = new u(), this._panEnd = new u(), this._panDelta = new u(), this._dollyStart = new u(), this._dollyEnd = new u(), this._dollyDelta = new u(), this._dollyDirection = new f(), this._mouse = new u(), this._performCursorZoom = !1, this._pointers = [], this._pointerPositions = {}, this._controlActive = !1, this._onPointerMove = z.bind(this), this._onPointerDown = R.bind(this), this._onPointerUp = B.bind(this), this._onContextMenu = q.bind(this), this._onMouseWheel = U.bind(this), this._onKeyDown = W.bind(this), this._onTouchStart = G.bind(this), this._onTouchMove = K.bind(this), this._onMouseDown = V.bind(this), this._onMouseMove = H.bind(this), this._interceptControlDown = J.bind(this), this._interceptControlUp = Y.bind(this), this.domElement !== null && this.connect(this.domElement), this.update();
	}
	connect(e) {
		super.connect(e), this.domElement.addEventListener("pointerdown", this._onPointerDown), this.domElement.addEventListener("pointercancel", this._onPointerUp), this.domElement.addEventListener("contextmenu", this._onContextMenu), this.domElement.addEventListener("wheel", this._onMouseWheel, { passive: !1 }), this.domElement.getRootNode().addEventListener("keydown", this._interceptControlDown, {
			passive: !0,
			capture: !0
		}), this.domElement.style.touchAction = "none";
	}
	disconnect() {
		this.domElement.removeEventListener("pointerdown", this._onPointerDown), this.domElement.removeEventListener("pointermove", this._onPointerMove), this.domElement.removeEventListener("pointerup", this._onPointerUp), this.domElement.removeEventListener("pointercancel", this._onPointerUp), this.domElement.removeEventListener("wheel", this._onMouseWheel), this.domElement.removeEventListener("contextmenu", this._onContextMenu), this.stopListenToKeyEvents(), this.domElement.getRootNode().removeEventListener("keydown", this._interceptControlDown, { capture: !0 }), this.domElement.style.touchAction = "auto";
	}
	dispose() {
		this.disconnect();
	}
	getPolarAngle() {
		return this._spherical.phi;
	}
	getAzimuthalAngle() {
		return this._spherical.theta;
	}
	getDistance() {
		return this.object.position.distanceTo(this.target);
	}
	listenToKeyEvents(e) {
		e.addEventListener("keydown", this._onKeyDown), this._domElementKeyEvents = e;
	}
	stopListenToKeyEvents() {
		this._domElementKeyEvents !== null && (this._domElementKeyEvents.removeEventListener("keydown", this._onKeyDown), this._domElementKeyEvents = null);
	}
	saveState() {
		this.target0.copy(this.target), this.position0.copy(this.object.position), this.zoom0 = this.object.zoom;
	}
	reset() {
		this.target.copy(this.target0), this.object.position.copy(this.position0), this.object.zoom = this.zoom0, this.object.updateProjectionMatrix(), this.dispatchEvent(D), this.update(), this.state = F.NONE;
	}
	update(e = null) {
		let t = this.object.position;
		N.copy(t).sub(this.target), N.applyQuaternion(this._quat), this._spherical.setFromVector3(N), this.autoRotate && this.state === F.NONE && this._rotateLeft(this._getAutoRotationAngle(e)), this.enableDamping ? (this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor, this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor) : (this._spherical.theta += this._sphericalDelta.theta, this._spherical.phi += this._sphericalDelta.phi);
		let n = this.minAzimuthAngle, r = this.maxAzimuthAngle;
		isFinite(n) && isFinite(r) && (n < -Math.PI ? n += P : n > Math.PI && (n -= P), r < -Math.PI ? r += P : r > Math.PI && (r -= P), n <= r ? this._spherical.theta = Math.max(n, Math.min(r, this._spherical.theta)) : this._spherical.theta = this._spherical.theta > (n + r) / 2 ? Math.max(n, this._spherical.theta) : Math.min(r, this._spherical.theta)), this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi)), this._spherical.makeSafe(), this.enableDamping === !0 ? this.target.addScaledVector(this._panOffset, this.dampingFactor) : this.target.add(this._panOffset), this.target.sub(this.cursor), this.target.clampLength(this.minTargetRadius, this.maxTargetRadius), this.target.add(this.cursor);
		let i = !1;
		if (this.zoomToCursor && this._performCursorZoom || this.object.isOrthographicCamera) this._spherical.radius = this._clampDistance(this._spherical.radius);
		else {
			let e = this._spherical.radius;
			this._spherical.radius = this._clampDistance(this._spherical.radius * this._scale), i = e != this._spherical.radius;
		}
		if (N.setFromSpherical(this._spherical), N.applyQuaternion(this._quatInverse), t.copy(this.target).add(N), this.object.lookAt(this.target), this.enableDamping === !0 ? (this._sphericalDelta.theta *= 1 - this.dampingFactor, this._sphericalDelta.phi *= 1 - this.dampingFactor, this._panOffset.multiplyScalar(1 - this.dampingFactor)) : (this._sphericalDelta.set(0, 0, 0), this._panOffset.set(0, 0, 0)), this.zoomToCursor && this._performCursorZoom) {
			let e = null;
			if (this.object.isPerspectiveCamera) {
				let t = N.length();
				e = this._clampDistance(t * this._scale);
				let n = t - e;
				this.object.position.addScaledVector(this._dollyDirection, n), this.object.updateMatrixWorld(), i = !!n;
			} else if (this.object.isOrthographicCamera) {
				let t = new f(this._mouse.x, this._mouse.y, 0);
				t.unproject(this.object);
				let n = this.object.zoom;
				this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale)), this.object.updateProjectionMatrix(), i = n !== this.object.zoom;
				let r = new f(this._mouse.x, this._mouse.y, 0);
				r.unproject(this.object), this.object.position.sub(r).add(t), this.object.updateMatrixWorld(), e = N.length();
			} else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."), this.zoomToCursor = !1;
			e !== null && (this.screenSpacePanning ? this.target.set(0, 0, -1).transformDirection(this.object.matrix).multiplyScalar(e).add(this.object.position) : (A.origin.copy(this.object.position), A.direction.set(0, 0, -1).transformDirection(this.object.matrix), Math.abs(this.object.up.dot(A.direction)) < M ? this.object.lookAt(this.target) : (j.setFromNormalAndCoplanarPoint(this.object.up, this.target), A.intersectPlane(j, this.target))));
		} else if (this.object.isOrthographicCamera) {
			let e = this.object.zoom;
			this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale)), e !== this.object.zoom && (this.object.updateProjectionMatrix(), i = !0);
		}
		return this._scale = 1, this._performCursorZoom = !1, i || this._lastPosition.distanceToSquared(this.object.position) > I || 8 * (1 - this._lastQuaternion.dot(this.object.quaternion)) > I || this._lastTargetPosition.distanceToSquared(this.target) > I ? (this.dispatchEvent(D), this._lastPosition.copy(this.object.position), this._lastQuaternion.copy(this.object.quaternion), this._lastTargetPosition.copy(this.target), !0) : !1;
	}
	_getAutoRotationAngle(e) {
		return e === null ? P / 60 / 60 * this.autoRotateSpeed : P / 60 * this.autoRotateSpeed * e;
	}
	_getZoomScale(e) {
		let t = Math.abs(e * .01);
		return .95 ** (this.zoomSpeed * t);
	}
	_rotateLeft(e) {
		this._sphericalDelta.theta -= e;
	}
	_rotateUp(e) {
		this._sphericalDelta.phi -= e;
	}
	_panLeft(e, t) {
		N.setFromMatrixColumn(t, 0), N.multiplyScalar(-e), this._panOffset.add(N);
	}
	_panUp(e, t) {
		this.screenSpacePanning === !0 ? N.setFromMatrixColumn(t, 1) : (N.setFromMatrixColumn(t, 0), N.crossVectors(this.object.up, N)), N.multiplyScalar(e), this._panOffset.add(N);
	}
	_pan(e, t) {
		let n = this.domElement;
		if (this.object.isPerspectiveCamera) {
			let r = this.object.position;
			N.copy(r).sub(this.target);
			let i = N.length();
			i *= Math.tan(this.object.fov / 2 * Math.PI / 180), this._panLeft(2 * e * i / n.clientHeight, this.object.matrix), this._panUp(2 * t * i / n.clientHeight, this.object.matrix);
		} else this.object.isOrthographicCamera ? (this._panLeft(e * (this.object.right - this.object.left) / this.object.zoom / n.clientWidth, this.object.matrix), this._panUp(t * (this.object.top - this.object.bottom) / this.object.zoom / n.clientHeight, this.object.matrix)) : (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."), this.enablePan = !1);
	}
	_dollyOut(e) {
		this.object.isPerspectiveCamera || this.object.isOrthographicCamera ? this._scale /= e : (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."), this.enableZoom = !1);
	}
	_dollyIn(e) {
		this.object.isPerspectiveCamera || this.object.isOrthographicCamera ? this._scale *= e : (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."), this.enableZoom = !1);
	}
	_updateZoomParameters(e, t) {
		if (!this.zoomToCursor) return;
		this._performCursorZoom = !0;
		let n = this.domElement.getBoundingClientRect(), r = e - n.left, i = t - n.top, a = n.width, o = n.height;
		this._mouse.x = r / a * 2 - 1, this._mouse.y = -(i / o) * 2 + 1, this._dollyDirection.set(this._mouse.x, this._mouse.y, 1).unproject(this.object).sub(this.object.position).normalize();
	}
	_clampDistance(e) {
		return Math.max(this.minDistance, Math.min(this.maxDistance, e));
	}
	_handleMouseDownRotate(e) {
		this._rotateStart.set(e.clientX, e.clientY);
	}
	_handleMouseDownDolly(e) {
		this._updateZoomParameters(e.clientX, e.clientX), this._dollyStart.set(e.clientX, e.clientY);
	}
	_handleMouseDownPan(e) {
		this._panStart.set(e.clientX, e.clientY);
	}
	_handleMouseMoveRotate(e) {
		this._rotateEnd.set(e.clientX, e.clientY), this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);
		let t = this.domElement;
		this._rotateLeft(P * this._rotateDelta.x / t.clientHeight), this._rotateUp(P * this._rotateDelta.y / t.clientHeight), this._rotateStart.copy(this._rotateEnd), this.update();
	}
	_handleMouseMoveDolly(e) {
		this._dollyEnd.set(e.clientX, e.clientY), this._dollyDelta.subVectors(this._dollyEnd, this._dollyStart), this._dollyDelta.y > 0 ? this._dollyOut(this._getZoomScale(this._dollyDelta.y)) : this._dollyDelta.y < 0 && this._dollyIn(this._getZoomScale(this._dollyDelta.y)), this._dollyStart.copy(this._dollyEnd), this.update();
	}
	_handleMouseMovePan(e) {
		this._panEnd.set(e.clientX, e.clientY), this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed), this._pan(this._panDelta.x, this._panDelta.y), this._panStart.copy(this._panEnd), this.update();
	}
	_handleMouseWheel(e) {
		this._updateZoomParameters(e.clientX, e.clientY), e.deltaY < 0 ? this._dollyIn(this._getZoomScale(e.deltaY)) : e.deltaY > 0 && this._dollyOut(this._getZoomScale(e.deltaY)), this.update();
	}
	_handleKeyDown(e) {
		let t = !1;
		switch (e.code) {
			case this.keys.UP:
				e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateUp(P * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(0, this.keyPanSpeed), t = !0;
				break;
			case this.keys.BOTTOM:
				e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateUp(-P * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(0, -this.keyPanSpeed), t = !0;
				break;
			case this.keys.LEFT:
				e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateLeft(P * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(this.keyPanSpeed, 0), t = !0;
				break;
			case this.keys.RIGHT: e.ctrlKey || e.metaKey || e.shiftKey ? this.enableRotate && this._rotateLeft(-P * this.keyRotateSpeed / this.domElement.clientHeight) : this.enablePan && this._pan(-this.keyPanSpeed, 0), t = !0;
		}
		t && (e.preventDefault(), this.update());
	}
	_handleTouchStartRotate(e) {
		if (this._pointers.length === 1) this._rotateStart.set(e.pageX, e.pageY);
		else {
			let t = this._getSecondPointerPosition(e), n = .5 * (e.pageX + t.x), r = .5 * (e.pageY + t.y);
			this._rotateStart.set(n, r);
		}
	}
	_handleTouchStartPan(e) {
		if (this._pointers.length === 1) this._panStart.set(e.pageX, e.pageY);
		else {
			let t = this._getSecondPointerPosition(e), n = .5 * (e.pageX + t.x), r = .5 * (e.pageY + t.y);
			this._panStart.set(n, r);
		}
	}
	_handleTouchStartDolly(e) {
		let t = this._getSecondPointerPosition(e), n = e.pageX - t.x, r = e.pageY - t.y, i = Math.sqrt(n * n + r * r);
		this._dollyStart.set(0, i);
	}
	_handleTouchStartDollyPan(e) {
		this.enableZoom && this._handleTouchStartDolly(e), this.enablePan && this._handleTouchStartPan(e);
	}
	_handleTouchStartDollyRotate(e) {
		this.enableZoom && this._handleTouchStartDolly(e), this.enableRotate && this._handleTouchStartRotate(e);
	}
	_handleTouchMoveRotate(e) {
		if (this._pointers.length == 1) this._rotateEnd.set(e.pageX, e.pageY);
		else {
			let t = this._getSecondPointerPosition(e), n = .5 * (e.pageX + t.x), r = .5 * (e.pageY + t.y);
			this._rotateEnd.set(n, r);
		}
		this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);
		let t = this.domElement;
		this._rotateLeft(P * this._rotateDelta.x / t.clientHeight), this._rotateUp(P * this._rotateDelta.y / t.clientHeight), this._rotateStart.copy(this._rotateEnd);
	}
	_handleTouchMovePan(e) {
		if (this._pointers.length === 1) this._panEnd.set(e.pageX, e.pageY);
		else {
			let t = this._getSecondPointerPosition(e), n = .5 * (e.pageX + t.x), r = .5 * (e.pageY + t.y);
			this._panEnd.set(n, r);
		}
		this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed), this._pan(this._panDelta.x, this._panDelta.y), this._panStart.copy(this._panEnd);
	}
	_handleTouchMoveDolly(e) {
		let t = this._getSecondPointerPosition(e), n = e.pageX - t.x, r = e.pageY - t.y, i = Math.sqrt(n * n + r * r);
		this._dollyEnd.set(0, i), this._dollyDelta.set(0, (this._dollyEnd.y / this._dollyStart.y) ** +this.zoomSpeed), this._dollyOut(this._dollyDelta.y), this._dollyStart.copy(this._dollyEnd);
		let a = (e.pageX + t.x) * .5, o = (e.pageY + t.y) * .5;
		this._updateZoomParameters(a, o);
	}
	_handleTouchMoveDollyPan(e) {
		this.enableZoom && this._handleTouchMoveDolly(e), this.enablePan && this._handleTouchMovePan(e);
	}
	_handleTouchMoveDollyRotate(e) {
		this.enableZoom && this._handleTouchMoveDolly(e), this.enableRotate && this._handleTouchMoveRotate(e);
	}
	_addPointer(e) {
		this._pointers.push(e.pointerId);
	}
	_removePointer(e) {
		delete this._pointerPositions[e.pointerId];
		for (let t = 0; t < this._pointers.length; t++) if (this._pointers[t] == e.pointerId) {
			this._pointers.splice(t, 1);
			return;
		}
	}
	_isTrackingPointer(e) {
		for (let t = 0; t < this._pointers.length; t++) if (this._pointers[t] == e.pointerId) return !0;
		return !1;
	}
	_trackPointer(e) {
		let t = this._pointerPositions[e.pointerId];
		t === void 0 && (t = new u(), this._pointerPositions[e.pointerId] = t), t.set(e.pageX, e.pageY);
	}
	_getSecondPointerPosition(e) {
		let t = e.pointerId === this._pointers[0] ? this._pointers[1] : this._pointers[0];
		return this._pointerPositions[t];
	}
	_customWheelEvent(e) {
		let t = e.deltaMode, n = {
			clientX: e.clientX,
			clientY: e.clientY,
			deltaY: e.deltaY
		};
		switch (t) {
			case 1:
				n.deltaY *= 16;
				break;
			case 2: n.deltaY *= 100;
		}
		return e.ctrlKey && !this._controlActive && (n.deltaY *= 10), n;
	}
};
function R(e) {
	this.enabled !== !1 && (this._pointers.length === 0 && (this.domElement.setPointerCapture(e.pointerId), this.domElement.addEventListener("pointermove", this._onPointerMove), this.domElement.addEventListener("pointerup", this._onPointerUp)), this._isTrackingPointer(e) || (this._addPointer(e), e.pointerType === "touch" ? this._onTouchStart(e) : this._onMouseDown(e)));
}
function z(e) {
	this.enabled !== !1 && (e.pointerType === "touch" ? this._onTouchMove(e) : this._onMouseMove(e));
}
function B(e) {
	switch (this._removePointer(e), this._pointers.length) {
		case 0:
			this.domElement.releasePointerCapture(e.pointerId), this.domElement.removeEventListener("pointermove", this._onPointerMove), this.domElement.removeEventListener("pointerup", this._onPointerUp), this.dispatchEvent(k), this.state = F.NONE;
			break;
		case 1:
			let t = this._pointers[0], n = this._pointerPositions[t];
			this._onTouchStart({
				pointerId: t,
				pageX: n.x,
				pageY: n.y
			});
	}
}
function V(e) {
	let t;
	switch (e.button) {
		case 0:
			t = this.mouseButtons.LEFT;
			break;
		case 1:
			t = this.mouseButtons.MIDDLE;
			break;
		case 2:
			t = this.mouseButtons.RIGHT;
			break;
		default: t = -1;
	}
	switch (t) {
		case m.DOLLY:
			if (this.enableZoom === !1) return;
			this._handleMouseDownDolly(e), this.state = F.DOLLY;
			break;
		case m.ROTATE:
			if (e.ctrlKey || e.metaKey || e.shiftKey) {
				if (this.enablePan === !1) return;
				this._handleMouseDownPan(e), this.state = F.PAN;
			} else {
				if (this.enableRotate === !1) return;
				this._handleMouseDownRotate(e), this.state = F.ROTATE;
			}
			break;
		case m.PAN:
			if (e.ctrlKey || e.metaKey || e.shiftKey) {
				if (this.enableRotate === !1) return;
				this._handleMouseDownRotate(e), this.state = F.ROTATE;
			} else {
				if (this.enablePan === !1) return;
				this._handleMouseDownPan(e), this.state = F.PAN;
			}
			break;
		default: this.state = F.NONE;
	}
	this.state !== F.NONE && this.dispatchEvent(O);
}
function H(e) {
	switch (this.state) {
		case F.ROTATE:
			if (this.enableRotate === !1) return;
			this._handleMouseMoveRotate(e);
			break;
		case F.DOLLY:
			if (this.enableZoom === !1) return;
			this._handleMouseMoveDolly(e);
			break;
		case F.PAN:
			if (this.enablePan === !1) return;
			this._handleMouseMovePan(e);
	}
}
function U(e) {
	this.enabled !== !1 && this.enableZoom !== !1 && this.state === F.NONE && (e.preventDefault(), this.dispatchEvent(O), this._handleMouseWheel(this._customWheelEvent(e)), this.dispatchEvent(k));
}
function W(e) {
	this.enabled !== !1 && this._handleKeyDown(e);
}
function G(e) {
	switch (this._trackPointer(e), this._pointers.length) {
		case 1:
			switch (this.touches.ONE) {
				case d.ROTATE:
					if (this.enableRotate === !1) return;
					this._handleTouchStartRotate(e), this.state = F.TOUCH_ROTATE;
					break;
				case d.PAN:
					if (this.enablePan === !1) return;
					this._handleTouchStartPan(e), this.state = F.TOUCH_PAN;
					break;
				default: this.state = F.NONE;
			}
			break;
		case 2:
			switch (this.touches.TWO) {
				case d.DOLLY_PAN:
					if (this.enableZoom === !1 && this.enablePan === !1) return;
					this._handleTouchStartDollyPan(e), this.state = F.TOUCH_DOLLY_PAN;
					break;
				case d.DOLLY_ROTATE:
					if (this.enableZoom === !1 && this.enableRotate === !1) return;
					this._handleTouchStartDollyRotate(e), this.state = F.TOUCH_DOLLY_ROTATE;
					break;
				default: this.state = F.NONE;
			}
			break;
		default: this.state = F.NONE;
	}
	this.state !== F.NONE && this.dispatchEvent(O);
}
function K(e) {
	switch (this._trackPointer(e), this.state) {
		case F.TOUCH_ROTATE:
			if (this.enableRotate === !1) return;
			this._handleTouchMoveRotate(e), this.update();
			break;
		case F.TOUCH_PAN:
			if (this.enablePan === !1) return;
			this._handleTouchMovePan(e), this.update();
			break;
		case F.TOUCH_DOLLY_PAN:
			if (this.enableZoom === !1 && this.enablePan === !1) return;
			this._handleTouchMoveDollyPan(e), this.update();
			break;
		case F.TOUCH_DOLLY_ROTATE:
			if (this.enableZoom === !1 && this.enableRotate === !1) return;
			this._handleTouchMoveDollyRotate(e), this.update();
			break;
		default: this.state = F.NONE;
	}
}
function q(e) {
	this.enabled !== !1 && e.preventDefault();
}
function J(e) {
	e.key === "Control" && (this._controlActive = !0, this.domElement.getRootNode().addEventListener("keyup", this._interceptControlUp, {
		passive: !0,
		capture: !0
	}));
}
function Y(e) {
	e.key === "Control" && (this._controlActive = !1, this.domElement.getRootNode().removeEventListener("keyup", this._interceptControlUp, {
		passive: !0,
		capture: !0
	}));
}
// vendor/three/examples/jsm/environments/RoomEnvironment.js
var X = class extends i {
	constructor() {
		super();
		let e = new p();
		e.deleteAttribute("uv");
		let i = new r({ side: 1 }), a = new r(), o = new _(16777215, 900, 28, 2);
		o.position.set(.418, 16.199, .3), this.add(o);
		let s = new t(e, i);
		s.position.set(-.757, 13.219, .717), s.scale.set(31.713, 28.305, 28.591), this.add(s);
		let c = new b(e, a, 6), l = new n();
		l.position.set(-10.906, 2.009, 1.846), l.rotation.set(0, -.195, 0), l.scale.set(2.328, 7.905, 4.651), l.updateMatrix(), c.setMatrixAt(0, l.matrix), l.position.set(-5.607, -.754, -.758), l.rotation.set(0, .994, 0), l.scale.set(1.97, 1.534, 3.955), l.updateMatrix(), c.setMatrixAt(1, l.matrix), l.position.set(6.167, .857, 7.803), l.rotation.set(0, .561, 0), l.scale.set(3.927, 6.285, 3.687), l.updateMatrix(), c.setMatrixAt(2, l.matrix), l.position.set(-2.017, .018, 6.124), l.rotation.set(0, .333, 0), l.scale.set(2.002, 4.566, 2.064), l.updateMatrix(), c.setMatrixAt(3, l.matrix), l.position.set(2.291, -.756, -2.621), l.rotation.set(0, -.286, 0), l.scale.set(1.546, 1.552, 1.496), l.updateMatrix(), c.setMatrixAt(4, l.matrix), l.position.set(-2.193, -.369, -5.547), l.rotation.set(0, .516, 0), l.scale.set(3.875, 3.487, 2.986), l.updateMatrix(), c.setMatrixAt(5, l.matrix), this.add(c);
		let u = new t(e, Z(50));
		u.position.set(-16.116, 14.37, 8.208), u.scale.set(.1, 2.428, 2.739), this.add(u);
		let d = new t(e, Z(50));
		d.position.set(-16.109, 18.021, -8.207), d.scale.set(.1, 2.425, 2.751), this.add(d);
		let f = new t(e, Z(17));
		f.position.set(14.904, 12.198, -1.832), f.scale.set(.15, 4.265, 6.331), this.add(f);
		let m = new t(e, Z(43));
		m.position.set(-.462, 8.89, 14.52), m.scale.set(4.38, 5.441, .088), this.add(m);
		let h = new t(e, Z(20));
		h.position.set(3.235, 11.486, -12.541), h.scale.set(2.5, 2, .1), this.add(h);
		let g = new t(e, Z(100));
		g.position.set(0, 20, 0), g.scale.set(1, .1, 1), this.add(g);
	}
	dispose() {
		let e = /* @__PURE__ */ new Set();
		this.traverse((t) => {
			t.isMesh && (e.add(t.geometry), e.add(t.material));
		});
		for (let t of e) t.dispose();
	}
};
function Z(e) {
	return new l({
		color: 0,
		emissive: 16777215,
		emissiveIntensity: e
	});
}
// home-src/mission-model.js
var Q = new f(0, 1.35, 0), $ = {
	front: [
		4.1,
		3.4,
		6.6
	],
	back: [
		-4.1,
		3,
		-6.6
	],
	top: [
		.4,
		8.4,
		1.8
	]
}, ee = (e) => 1 - (1 - e) ** 3;
function te(e, { url: t, onReady: n = () => {}, onError: r = () => {}, onUserOrbit: a = () => {}, quality: s = "hero", ariaLabel: l = "SPHEREx 3D model. Drag to turn it. To zoom, use two fingers, or ⌘ or Ctrl together with scroll. The arrow keys turn it too.", lostMessage: u = "The graphics connection was lost. Reload the page to see it again." } = {}) {
	let d = {
		ariaLabel: l,
		lostMessage: u
	}, p = s === "lite" ? 1.25 : 1.75, m = new C({
		antialias: !0,
		alpha: !0,
		powerPreference: "high-performance"
	});
	m.setClearColor(0, 0), m.toneMapping = 4, m.toneMappingExposure = .9, m.setPixelRatio(Math.min(window.devicePixelRatio || 1, p));
	let _ = m.domElement;
	_.setAttribute("aria-label", d.ariaLabel), _.setAttribute("role", "img"), _.tabIndex = 0, e.append(_);
	let v = new i(), y = new o(32, 1, .04, 80), b = new x(m), E = new X(), D = b.fromScene(E, .03);
	E.dispose(), v.environment = D.texture, v.environmentIntensity = .8, v.environmentRotation.y = .6;
	let O = new T(15265791, 1.6);
	O.position.set(2, 5, 4), v.add(O);
	let k = new T(11913983, 1);
	k.position.set(-4, 3, -2), v.add(k);
	let A = new T(16768176, .7);
	A.position.set(4, 1, -3), v.add(A), v.add(new S(15003391, 1581357, .3));
	let j = new h();
	v.add(j);
	let M = new L(y, _);
	M.enableDamping = !0, M.dampingFactor = .08, M.minDistance = 2.4, M.maxDistance = 12, M.autoRotateSpeed = .6, M.enableZoom = !1, M.enablePan = !1, M.target.copy(Q), M.listenToKeyEvents(_), y.position.set(...$.front), M.update();
	let N = {
		alive: !0,
		hostActive: !0,
		visible: !1,
		frame: 0,
		last: 0,
		free: !1,
		coarse: matchMedia("(pointer: coarse)").matches,
		yaw: 0,
		yawTarget: 0,
		lift: 0,
		liftTarget: 0,
		open: 0,
		openTarget: 0,
		userCutaway: null,
		layers: [],
		settle: 0
	}, P = (e) => {
		M.enableZoom = N.free || e.ctrlKey || e.metaKey;
	};
	e.addEventListener("wheel", P, {
		capture: !0,
		passive: !0
	});
	let F = () => {
		let e = N.free || !N.coarse;
		M.enabled = e, _.style.touchAction = e ? "none" : "pan-y", M.enablePan = N.free;
	};
	F(), M.addEventListener("change", () => K()), M.addEventListener("start", () => {
		N.dragging = !0, M.autoRotate = !1, a(), K();
	}), M.addEventListener("end", () => {
		N.dragging = !1, K();
	});
	function I() {
		let { width: t, height: n } = e.getBoundingClientRect();
		t && n && (y.aspect = t / n, y.fov = y.aspect < .9 ? 40 : 32, y.updateProjectionMatrix(), m.setSize(t, n, !1), _.style.width = "100%", _.style.height = "100%", K());
	}
	let R = new ResizeObserver(I);
	R.observe(e);
	let z = new IntersectionObserver(([e]) => {
		N.visible = e.isIntersecting, N.visible && !N.frame && N.alive && (N.settle = 2, N.frame = requestAnimationFrame(J));
	}, { rootMargin: "120px" });
	z.observe(e);
	let B = () => {
		document.hidden || K();
	};
	document.addEventListener("visibilitychange", B);
	let V = (t) => {
		t.preventDefault(), e.dispatchEvent(new CustomEvent("model-error", { detail: d.lostMessage }));
	};
	_.addEventListener("webglcontextlost", V);
	let H = Math.min(window.devicePixelRatio || 1, p, 1.6), U = Math.min(H, 1), W = 0;
	function G(t) {
		if (m.getPixelRatio() === t) return;
		let { width: n, height: r } = e.getBoundingClientRect();
		m.setPixelRatio(t), n && r && m.setSize(n, r, !1);
	}
	function K() {
		N.alive && N.hostActive && N.visible && !document.hidden && (N.settle = 24, N.frame ||= (clearTimeout(W), G(U), requestAnimationFrame(J)));
	}
	function q() {
		clearTimeout(W), W = setTimeout(() => {
			N.alive && N.hostActive && !document.hidden && !N.frame && N.visible && (G(H), m.render(v, y), N.renders = (N.renders || 0) + 1);
		}, 180);
	}
	function J(e) {
		if (N.frame = -1, !N.alive || !N.hostActive || !N.visible || document.hidden) {
			N.frame = 0, N.last = 0;
			return;
		}
		let t = N.last ? (e - N.last) / 1e3 : 0;
		if (t > 0 && t < .25 && (N.govAcc = (N.govAcc || 0) + t, N.govN = (N.govN || 0) + 1, N.govAcc > 1.5)) {
			let e = N.govAcc / N.govN;
			N.govAcc = N.govN = 0, e > 1 / 48 && H > 1 && (H = Math.max(1, H - .3), U = Math.min(U, H));
		}
		let n = N.last ? Math.min((e - N.last) / 1e3, .05) : 1 / 60;
		N.last = e;
		let r = 1 - Math.exp(-n * 7);
		N.yaw += (N.yawTarget - N.yaw) * r, N.lift += (N.liftTarget - N.lift) * r, j.rotation.y = N.yaw, j.position.y = N.lift;
		let i = N.userCutaway ?? N.openTarget;
		N.open += (i - N.open) * (1 - Math.exp(-n * 2.4)), Math.abs(i - N.open) < .001 && (N.open = i);
		for (let e of N.layers) {
			let t = ee(Math.min(1, Math.max(0, (N.open - e.delay) / (1 - e.delay))));
			e.node.position.copy(e.base).addScaledVector(e.dir, t * e.reach);
		}
		if (N.tween) {
			let t = Math.min(1, (e - N.tween.start) / 900), n = 1 - (1 - t) ** 4;
			y.position.lerpVectors(N.tween.from, N.tween.to, n), M.target.lerpVectors(N.tween.fromTarget, Q, n), t >= 1 && (N.tween = null);
		}
		M.update(n), m.render(v, y), N.renders = (N.renders || 0) + 1;
		let a = Math.abs(N.yawTarget - N.yaw) > 4e-4 || Math.abs(N.liftTarget - N.lift) > 4e-4 || N.open !== i || M.autoRotate || !!N.tween || N.dragging;
		a && (N.settle = 24), a || --N.settle > 0 ? N.frame = requestAnimationFrame(J) : (N.frame = 0, N.last = 0, q());
	}
	let Y = null;
	new w().loadAsync(t).then((e) => {
		if (!N.alive) {
			Z(e.scene);
			return;
		}
		Y = e.scene, j.add(Y), Y.updateMatrixWorld(!0);
		let t = new f(), r = new g(), i = new g().setFromObject(Y), a = i.getCenter(new f()), o = Math.max(i.max.x - i.min.x, i.max.z - i.min.z) / 2;
		Y.traverse((e) => {
			if (e.userData?.cutaway !== !0) return;
			r.setFromObject(e).getCenter(t);
			let n = new f(t.x - a.x, 0, t.z - a.z);
			n.lengthSq() < 1e-6 && n.set(0, 0, 1), n.normalize();
			let i = new c().copy(e.parent.matrixWorld).invert(), s = n.clone().transformDirection(i), l = e.name || "", u = l.includes("Outer") ? 0 : l.includes("Middle") ? 1 : 2, d = e.parent.getWorldScale(new f()).x || 1;
			N.layers.push({
				node: e,
				base: e.position.clone(),
				dir: s,
				reach: o * [
					1.9,
					1.6,
					1.35
				][u] / d,
				delay: [
					0,
					.14,
					.28
				][u]
			});
		}), I();
		let s = m.compileAsync ? m.compileAsync(v, y).catch(() => {}) : Promise.resolve();
		Y.traverse((e) => {
			for (let t of [].concat(e.material || [])) for (let e of [
				"map",
				"normalMap",
				"roughnessMap",
				"metalnessMap",
				"emissiveMap",
				"aoMap"
			]) t[e] && m.initTexture(t[e]);
		}), s.then(() => {
			N.alive && (n(), K(), q());
		});
	}).catch((e) => {
		N.alive && r(e);
	});
	function Z(e) {
		let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
		e.traverse((e) => {
			e.geometry && t.add(e.geometry);
			for (let t of [].concat(e.material || [])) n.add(t);
		}), t.forEach((e) => e.dispose()), n.forEach((e) => e.dispose());
	}
	return {
		setLabels({ ariaLabel: e, lostMessage: t } = {}) {
			typeof e == "string" && (d.ariaLabel = e, _.setAttribute("aria-label", e)), typeof t == "string" && (d.lostMessage = t);
		},
		setProgress(e, t) {
			N.yawTarget = -.55 + e * 2.6, N.liftTarget = Math.sin(e * Math.PI) * .08, N.openTarget = +(t >= 2), K();
		},
		setActive(e) {
			N.hostActive = !!e, N.hostActive ? K() : (cancelAnimationFrame(N.frame), clearTimeout(W), N.frame = 0, N.last = 0);
		},
		setCutaway(e) {
			N.userCutaway = +!!e, K();
		},
		get cutaway() {
			return (N.userCutaway ?? N.openTarget) > .5;
		},
		view(e) {
			let t = $[e] || $.front;
			M.autoRotate = !1, N.tween = {
				from: y.position.clone(),
				to: new f(...t),
				fromTarget: M.target.clone(),
				start: performance.now()
			}, K();
		},
		reset() {
			N.userCutaway = null, M.autoRotate = !1, this.view("front");
		},
		setAutoRotate(e) {
			M.autoRotate = !!e, K();
		},
		get autoRotate() {
			return M.autoRotate;
		},
		setFree(e) {
			N.free = !!e, F(), requestAnimationFrame(I);
		},
		stats() {
			return {
				renders: N.renders || 0,
				triangles: m.info.render.triangles,
				calls: m.info.render.calls,
				loaded: !!Y,
				pixelRatio: m.getPixelRatio()
			};
		},
		dispose() {
			N.alive = !1, cancelAnimationFrame(N.frame), clearTimeout(W), e.removeEventListener("wheel", P, { capture: !0 }), R.disconnect(), z.disconnect(), document.removeEventListener("visibilitychange", B), _.removeEventListener("webglcontextlost", V), M.dispose(), Y && Z(Y), D.dispose(), b.dispose(), m.dispose(), _.remove();
		}
	};
}
export { te as mountMissionModel };
