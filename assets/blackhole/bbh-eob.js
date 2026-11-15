/*
 * Conservative 2PN effective-one-body dynamics + leading circular GW torque.
 * [ADDED MODEL] Buonanno & Damour, PRD 62, 064015 (2000),
 * https://arxiv.org/abs/gr-qc/0001013, eqs. (2.11), (2.14–16), §III.
 * A=1-2/r+2ν/r³, D=1-6ν/r², B=D/A;
 * H_eff=√[A(1+p_r²/B+j²/r²)], h=√[1+2ν(H_eff-1)].
 * Hamilton's equations use H_real/μ=h/ν, with τ=tc³/(GM).
 * F_j=−(32/5)ν sign(Ω)|Ω|^(7/3), F_r=0: LEADING quasi-circular
 * radiation only, not the paper's resummed higher-order flux or a calibrated
 * SEOBNR model. In the ν→0 limit the conservative dynamics is Schwarzschild.
 *
 * The screen's PN→EOB velocity matching is an ILLUSTRATIVE coordinate stitch,
 * not the paper's canonical harmonic→ADM→EOB transformation. No orbit is
 * prescribed, no inward velocity is forced, and unbound orbits may escape.
 * The integrator ends at r=3; it does not find a common apparent horizon.
 */
(function(root) {
  "use strict";
  class BBHEOB {
    constructor(state, eta, { radiation = 1 } = {}) {
      this.state = Float64Array.from(state); // r, φ, p_r, j
      this.eta = eta;
      this.radiation = radiation;
      this.work = Array.from({length:6}, () => new Float64Array(4));
    }
    static metric(r, eta) {
      const u=1/r, A=1-2*u+2*eta*u**3, Ap=2*u*u-6*eta*u**4;
      const D=1-6*eta*u*u, Dp=12*eta*u**3;
      return {A, Ap, B:D/A, Bp:Dp/A-D*Ap/(A*A)};
    }
    static energy(s, eta) {
      const [r,,pr,j]=s, {A,B}=BBHEOB.metric(r,eta);
      const e=Math.sqrt(A*(1+pr*pr/B+j*j/(r*r)));
      const h=Math.sqrt(1+2*eta*(e-1));
      return {effective:e, total:h, binding:2*(e-1)/(1+h)};
    }
    static rhs(s, eta, radiation, out = new Float64Array(4)) {
      const [r,,pr,j]=s, u=1/r, A=1-2*u+2*eta*u**3, Ap=2*u*u-6*eta*u**4;
      const D=1-6*eta*u*u, Dp=12*eta*u**3, B=D/A, Bp=Dp/A-D*Ap/(A*A);
      const V=1+pr*pr/B+j*j*u*u, e=Math.sqrt(A*V), h=Math.sqrt(1+2*eta*(e-1));
      const common=1/(h*e), omega=A*j*u*u*common;
      out[0]=A*pr/B*common;
      out[1]=omega;
      out[2]=-.5*(Ap*V-A*(pr*pr*Bp/(B*B)+2*j*j*u**3))*common;
      out[3]=-radiation*(32/5)*eta*Math.sign(omega)*Math.abs(omega)**(7/3);
      return out;
    }
    static circularJ(r, eta) {
      const {A,Ap}=BBHEOB.metric(r,eta);
      return Math.sqrt(r**3*Ap/(2*A-r*Ap));
    }
    /** Match coordinate ṙ/c and M φ̇/c on the low-momentum branch.
     * Return null for inadmissible velocities instead of clamping an orbit.
     */
    static fromVelocity(r, phi, vr, omega, eta) {
      const {A,B}=BBHEOB.metric(r,eta), q=(B*vr*vr+r*r*omega*omega)/A;
      if (!(A>0 && B>0 && q<1)) return null;
      let e;
      if (eta<1e-10 || q<1e-16) e=Math.sqrt(A/(1-q));
      else {
        let lo=Math.sqrt(A), hi=(1-q+2*eta*q)/(3*eta*q);
        const f=x=>x*x*(1-q*(1+2*eta*(x-1)))-A;
        if (!(hi>lo && f(hi)>=0)) return null;
        for(let k=0;k<64;k++) { const mid=(lo+hi)/2; if(f(mid)>0)hi=mid; else lo=mid; }
        e=(lo+hi)/2;
      }
      const common=e*Math.sqrt(1+2*eta*(e-1));
      return new BBHEOB([r,phi,vr*B*common/A,omega*r*r*common/A],eta);
    }
    step(dt) {
      const s=this.state, [k1,k2,k3,k4,tmp]=this.work;
      BBHEOB.rhs(s,this.eta,this.radiation,k1);
      for(let i=0;i<4;i++)tmp[i]=s[i]+dt*k1[i]/2;
      BBHEOB.rhs(tmp,this.eta,this.radiation,k2);
      for(let i=0;i<4;i++)tmp[i]=s[i]+dt*k2[i]/2;
      BBHEOB.rhs(tmp,this.eta,this.radiation,k3);
      for(let i=0;i<4;i++)tmp[i]=s[i]+dt*k3[i];
      BBHEOB.rhs(tmp,this.eta,this.radiation,k4);
      for(let i=0;i<4;i++)s[i]+=dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6;
      return s;
    }
    static velocity(s,eta,out=new Float64Array(2)) {
      const f=BBHEOB.rhs(s,eta,0), r=s[0], phi=s[1], cs=Math.cos(phi), sn=Math.sin(phi);
      out[0]=f[0]*cs-r*f[1]*sn; out[1]=f[0]*sn+r*f[1]*cs;
      return out;
    }
    /** Directional derivative of the Hamiltonian velocity, used for Q̈.
     * The centred difference is in state space, never across render frames.
     */
    kinematics() {
      const s=this.state, f=this.work[0], plus=this.work[1], minus=this.work[2], eps=1e-4;
      BBHEOB.rhs(s,this.eta,this.radiation,f);
      for(let i=0;i<4;i++) { plus[i]=s[i]+eps*f[i]; minus[i]=s[i]-eps*f[i]; }
      const vp=BBHEOB.velocity(plus,this.eta), vm=BBHEOB.velocity(minus,this.eta);
      const v=BBHEOB.velocity(s,this.eta);
      return {x:s[0]*Math.cos(s[1]), y:s[0]*Math.sin(s[1]), vx:v[0],vy:v[1],ax:(vp[0]-vm[0])/(2*eps),ay:(vp[1]-vm[1])/(2*eps)};
    }
  }
  if(typeof module!=="undefined"&&module.exports)module.exports=BBHEOB;
  else root.BBHEOB=BBHEOB;
})(typeof self!=="undefined"?self:this);
