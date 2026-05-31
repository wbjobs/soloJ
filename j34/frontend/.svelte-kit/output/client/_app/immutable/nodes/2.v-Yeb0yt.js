import{t as zn,o as Ot,e as dt,q as Gs,p as ea,c as Vs,s as Ws,w as ct}from"../chunks/DZArhIYZ.js";import{S as Hn,s as kn,m as Q,t as $e,a as D,u as Et,b as H,f as Z,d as fe,g as Ee,p as at,n as J,z as ye,l as Ji,w as gt,y as Pi,h as Ye,A as je,B as Ti,x as En,k as Cn,E as an,D as on,v as Pn,e as Ln,j as Dn,C as rn,c as nc,r as ic,q as sc}from"../chunks/D5D7UFLe.js";import{d as rc,w as It}from"../chunks/BWsp-3_m.js";function un(i){return(i==null?void 0:i.length)!==void 0?i:Array.from(i)}/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const ta="160",oi={ROTATE:0,DOLLY:1,PAN:2},li={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},ac=0,pa=1,oc=2,pl=1,lc=2,vn=3,Bn=0,Ht=1,cn=2,Nn=0,Ri=1,ma=2,_a=3,ga=4,cc=5,Kn=100,uc=101,hc=102,va=103,xa=104,fc=200,dc=201,pc=202,mc=203,kr=204,Gr=205,_c=206,gc=207,vc=208,xc=209,Mc=210,Sc=211,Ec=212,yc=213,bc=214,Tc=0,Ac=1,wc=2,Us=3,Rc=4,Cc=5,Pc=6,Lc=7,ml=0,Dc=1,Ic=2,Fn=0,Uc=1,Nc=2,Fc=3,_l=4,Oc=5,Bc=6,gl=300,Li=301,Di=302,Vr=303,Wr=304,Xs=306,Xr=1e3,tn=1001,qr=1002,Ft=1003,Ma=1004,er=1005,jt=1006,zc=1007,Qi=1008,On=1009,Hc=1010,kc=1011,na=1012,vl=1013,In=1014,Un=1015,$i=1016,xl=1017,Ml=1018,Qn=1020,Gc=1021,nn=1023,Vc=1024,Wc=1025,$n=1026,Ii=1027,Xc=1028,Sl=1029,qc=1030,El=1031,yl=1033,tr=33776,nr=33777,ir=33778,sr=33779,Sa=35840,Ea=35841,ya=35842,ba=35843,bl=36196,Ta=37492,Aa=37496,wa=37808,Ra=37809,Ca=37810,Pa=37811,La=37812,Da=37813,Ia=37814,Ua=37815,Na=37816,Fa=37817,Oa=37818,Ba=37819,za=37820,Ha=37821,rr=36492,ka=36494,Ga=36495,Yc=36283,Va=36284,Wa=36285,Xa=36286,Tl=3e3,ei=3001,jc=3200,Kc=3201,Al=0,Zc=1,Zt="",wt="srgb",Sn="srgb-linear",ia="display-p3",qs="display-p3-linear",Ns="linear",ht="srgb",Fs="rec709",Os="p3",ci=7680,qa=519,Jc=512,Qc=513,$c=514,wl=515,eu=516,tu=517,nu=518,iu=519,Ya=35044,ja="300 es",Yr=1035,Mn=2e3,Bs=2001;class ri{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;const n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;const s=this._listeners[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){if(this._listeners===void 0)return;const n=this._listeners[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const Pt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],qi=Math.PI/180,jr=180/Math.PI;function es(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Pt[i&255]+Pt[i>>8&255]+Pt[i>>16&255]+Pt[i>>24&255]+"-"+Pt[e&255]+Pt[e>>8&255]+"-"+Pt[e>>16&15|64]+Pt[e>>24&255]+"-"+Pt[t&63|128]+Pt[t>>8&255]+"-"+Pt[t>>16&255]+Pt[t>>24&255]+Pt[n&255]+Pt[n>>8&255]+Pt[n>>16&255]+Pt[n>>24&255]).toLowerCase()}function Dt(i,e,t){return Math.max(e,Math.min(t,i))}function su(i,e){return(i%e+e)%e}function ar(i,e,t){return(1-t)*i+t*e}function Ka(i){return(i&i-1)===0&&i!==0}function Kr(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Hi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function zt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const ru={DEG2RAD:qi};class qe{constructor(e=0,t=0){qe.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Dt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class nt{constructor(e,t,n,s,r,a,o,l,c){nt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const u=this.elements;return u[0]=e,u[1]=s,u[2]=o,u[3]=t,u[4]=r,u[5]=l,u[6]=n,u[7]=a,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],u=n[4],h=n[7],f=n[2],m=n[5],_=n[8],g=s[0],p=s[3],d=s[6],M=s[1],v=s[4],E=s[7],T=s[2],w=s[5],y=s[8];return r[0]=a*g+o*M+l*T,r[3]=a*p+o*v+l*w,r[6]=a*d+o*E+l*y,r[1]=c*g+u*M+h*T,r[4]=c*p+u*v+h*w,r[7]=c*d+u*E+h*y,r[2]=f*g+m*M+_*T,r[5]=f*p+m*v+_*w,r[8]=f*d+m*E+_*y,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8];return t*a*u-t*o*c-n*r*u+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=u*a-o*c,f=o*l-u*r,m=c*r-a*l,_=t*h+n*f+s*m;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);const g=1/_;return e[0]=h*g,e[1]=(s*c-u*n)*g,e[2]=(o*n-s*a)*g,e[3]=f*g,e[4]=(u*t-s*l)*g,e[5]=(s*r-o*t)*g,e[6]=m*g,e[7]=(n*l-c*t)*g,e[8]=(a*t-n*r)*g,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(or.makeScale(e,t)),this}rotate(e){return this.premultiply(or.makeRotation(-e)),this}translate(e,t){return this.premultiply(or.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const or=new nt;function Rl(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function zs(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function au(){const i=zs("canvas");return i.style.display="block",i}const Za={};function Yi(i){i in Za||(Za[i]=!0,console.warn(i))}const Ja=new nt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),Qa=new nt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),ss={[Sn]:{transfer:Ns,primaries:Fs,toReference:i=>i,fromReference:i=>i},[wt]:{transfer:ht,primaries:Fs,toReference:i=>i.convertSRGBToLinear(),fromReference:i=>i.convertLinearToSRGB()},[qs]:{transfer:Ns,primaries:Os,toReference:i=>i.applyMatrix3(Qa),fromReference:i=>i.applyMatrix3(Ja)},[ia]:{transfer:ht,primaries:Os,toReference:i=>i.convertSRGBToLinear().applyMatrix3(Qa),fromReference:i=>i.applyMatrix3(Ja).convertLinearToSRGB()}},ou=new Set([Sn,qs]),ut={enabled:!0,_workingColorSpace:Sn,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(i){if(!ou.has(i))throw new Error(`Unsupported working color space, "${i}".`);this._workingColorSpace=i},convert:function(i,e,t){if(this.enabled===!1||e===t||!e||!t)return i;const n=ss[e].toReference,s=ss[t].fromReference;return s(n(i))},fromWorkingColorSpace:function(i,e){return this.convert(i,this._workingColorSpace,e)},toWorkingColorSpace:function(i,e){return this.convert(i,e,this._workingColorSpace)},getPrimaries:function(i){return ss[i].primaries},getTransfer:function(i){return i===Zt?Ns:ss[i].transfer}};function Ci(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function lr(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let ui;class Cl{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{ui===void 0&&(ui=zs("canvas")),ui.width=e.width,ui.height=e.height;const n=ui.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=ui}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=zs("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Ci(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Ci(t[n]/255)*255):t[n]=Ci(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let lu=0;class Pl{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:lu++}),this.uuid=es(),this.data=e,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(cr(s[a].image)):r.push(cr(s[a]))}else r=cr(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function cr(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Cl.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let cu=0;class Xt extends ri{constructor(e=Xt.DEFAULT_IMAGE,t=Xt.DEFAULT_MAPPING,n=tn,s=tn,r=jt,a=Qi,o=nn,l=On,c=Xt.DEFAULT_ANISOTROPY,u=Zt){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:cu++}),this.uuid=es(),this.name="",this.source=new Pl(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new qe(0,0),this.repeat=new qe(1,1),this.center=new qe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new nt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof u=="string"?this.colorSpace=u:(Yi("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=u===ei?wt:Zt),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==gl)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Xr:e.x=e.x-Math.floor(e.x);break;case tn:e.x=e.x<0?0:1;break;case qr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Xr:e.y=e.y-Math.floor(e.y);break;case tn:e.y=e.y<0?0:1;break;case qr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return Yi("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===wt?ei:Tl}set encoding(e){Yi("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=e===ei?wt:Zt}}Xt.DEFAULT_IMAGE=null;Xt.DEFAULT_MAPPING=gl;Xt.DEFAULT_ANISOTROPY=1;class pt{constructor(e=0,t=0,n=0,s=1){pt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],u=l[4],h=l[8],f=l[1],m=l[5],_=l[9],g=l[2],p=l[6],d=l[10];if(Math.abs(u-f)<.01&&Math.abs(h-g)<.01&&Math.abs(_-p)<.01){if(Math.abs(u+f)<.1&&Math.abs(h+g)<.1&&Math.abs(_+p)<.1&&Math.abs(c+m+d-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const v=(c+1)/2,E=(m+1)/2,T=(d+1)/2,w=(u+f)/4,y=(h+g)/4,L=(_+p)/4;return v>E&&v>T?v<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(v),s=w/n,r=y/n):E>T?E<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(E),n=w/s,r=L/s):T<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(T),n=y/r,s=L/r),this.set(n,s,r,t),this}let M=Math.sqrt((p-_)*(p-_)+(h-g)*(h-g)+(f-u)*(f-u));return Math.abs(M)<.001&&(M=1),this.x=(p-_)/M,this.y=(h-g)/M,this.z=(f-u)/M,this.w=Math.acos((c+m+d-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class uu extends ri{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new pt(0,0,e,t),this.scissorTest=!1,this.viewport=new pt(0,0,e,t);const s={width:e,height:t,depth:1};n.encoding!==void 0&&(Yi("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===ei?wt:Zt),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:jt,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new Xt(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(e,t,n=1){(this.width!==e||this.height!==t||this.depth!==n)&&(this.width=e,this.height=t,this.depth=n,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.texture.isRenderTargetTexture=!0;const t=Object.assign({},e.texture.image);return this.texture.source=new Pl(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ti extends uu{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Ll extends Xt{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Ft,this.minFilter=Ft,this.wrapR=tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class hu extends Xt{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Ft,this.minFilter=Ft,this.wrapR=tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ni{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],u=n[s+2],h=n[s+3];const f=r[a+0],m=r[a+1],_=r[a+2],g=r[a+3];if(o===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h;return}if(o===1){e[t+0]=f,e[t+1]=m,e[t+2]=_,e[t+3]=g;return}if(h!==g||l!==f||c!==m||u!==_){let p=1-o;const d=l*f+c*m+u*_+h*g,M=d>=0?1:-1,v=1-d*d;if(v>Number.EPSILON){const T=Math.sqrt(v),w=Math.atan2(T,d*M);p=Math.sin(p*w)/T,o=Math.sin(o*w)/T}const E=o*M;if(l=l*p+f*E,c=c*p+m*E,u=u*p+_*E,h=h*p+g*E,p===1-o){const T=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=T,c*=T,u*=T,h*=T}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],u=n[s+3],h=r[a],f=r[a+1],m=r[a+2],_=r[a+3];return e[t]=o*_+u*h+l*m-c*f,e[t+1]=l*_+u*f+c*h-o*m,e[t+2]=c*_+u*m+o*f-l*h,e[t+3]=u*_-o*h-l*f-c*m,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),u=o(s/2),h=o(r/2),f=l(n/2),m=l(s/2),_=l(r/2);switch(a){case"XYZ":this._x=f*u*h+c*m*_,this._y=c*m*h-f*u*_,this._z=c*u*_+f*m*h,this._w=c*u*h-f*m*_;break;case"YXZ":this._x=f*u*h+c*m*_,this._y=c*m*h-f*u*_,this._z=c*u*_-f*m*h,this._w=c*u*h+f*m*_;break;case"ZXY":this._x=f*u*h-c*m*_,this._y=c*m*h+f*u*_,this._z=c*u*_+f*m*h,this._w=c*u*h-f*m*_;break;case"ZYX":this._x=f*u*h-c*m*_,this._y=c*m*h+f*u*_,this._z=c*u*_-f*m*h,this._w=c*u*h+f*m*_;break;case"YZX":this._x=f*u*h+c*m*_,this._y=c*m*h+f*u*_,this._z=c*u*_-f*m*h,this._w=c*u*h-f*m*_;break;case"XZY":this._x=f*u*h-c*m*_,this._y=c*m*h-f*u*_,this._z=c*u*_+f*m*h,this._w=c*u*h+f*m*_;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],u=t[6],h=t[10],f=n+o+h;if(f>0){const m=.5/Math.sqrt(f+1);this._w=.25/m,this._x=(u-l)*m,this._y=(r-c)*m,this._z=(a-s)*m}else if(n>o&&n>h){const m=2*Math.sqrt(1+n-o-h);this._w=(u-l)/m,this._x=.25*m,this._y=(s+a)/m,this._z=(r+c)/m}else if(o>h){const m=2*Math.sqrt(1+o-n-h);this._w=(r-c)/m,this._x=(s+a)/m,this._y=.25*m,this._z=(l+u)/m}else{const m=2*Math.sqrt(1+h-n-o);this._w=(a-s)/m,this._x=(r+c)/m,this._y=(l+u)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Dt(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,u=t._w;return this._x=n*u+a*o+s*c-r*l,this._y=s*u+a*l+r*o-n*c,this._z=r*u+a*c+n*l-s*o,this._w=a*u-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,s=this._y,r=this._z,a=this._w;let o=a*e._w+n*e._x+s*e._y+r*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const m=1-t;return this._w=m*a+t*this._w,this._x=m*n+t*this._x,this._y=m*s+t*this._y,this._z=m*r+t*this._z,this.normalize(),this}const c=Math.sqrt(l),u=Math.atan2(c,o),h=Math.sin((1-t)*u)/c,f=Math.sin(t*u)/c;return this._w=a*h+this._w*f,this._x=n*h+this._x*f,this._y=s*h+this._y*f,this._z=r*h+this._z*f,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=Math.random(),t=Math.sqrt(1-e),n=Math.sqrt(e),s=2*Math.PI*Math.random(),r=2*Math.PI*Math.random();return this.set(t*Math.cos(s),n*Math.sin(r),n*Math.cos(r),t*Math.sin(s))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class F{constructor(e=0,t=0,n=0){F.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion($a.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion($a.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),u=2*(o*t-r*s),h=2*(r*n-a*t);return this.x=t+l*c+a*h-o*u,this.y=n+l*u+o*c-r*h,this.z=s+l*h+r*u-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return ur.copy(this).projectOnVector(e),this.sub(ur)}reflect(e){return this.sub(ur.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Dt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=(Math.random()-.5)*2,t=Math.random()*Math.PI*2,n=Math.sqrt(1-e**2);return this.x=n*Math.cos(t),this.y=n*Math.sin(t),this.z=e,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const ur=new F,$a=new ni;class ts{constructor(e=new F(1/0,1/0,1/0),t=new F(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Qt.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Qt.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Qt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Qt):Qt.fromBufferAttribute(r,a),Qt.applyMatrix4(e.matrixWorld),this.expandByPoint(Qt);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),rs.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),rs.copy(n.boundingBox)),rs.applyMatrix4(e.matrixWorld),this.union(rs)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,Qt),Qt.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ki),as.subVectors(this.max,ki),hi.subVectors(e.a,ki),fi.subVectors(e.b,ki),di.subVectors(e.c,ki),yn.subVectors(fi,hi),bn.subVectors(di,fi),Wn.subVectors(hi,di);let t=[0,-yn.z,yn.y,0,-bn.z,bn.y,0,-Wn.z,Wn.y,yn.z,0,-yn.x,bn.z,0,-bn.x,Wn.z,0,-Wn.x,-yn.y,yn.x,0,-bn.y,bn.x,0,-Wn.y,Wn.x,0];return!hr(t,hi,fi,di,as)||(t=[1,0,0,0,1,0,0,0,1],!hr(t,hi,fi,di,as))?!1:(os.crossVectors(yn,bn),t=[os.x,os.y,os.z],hr(t,hi,fi,di,as))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Qt).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Qt).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(dn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),dn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),dn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),dn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),dn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),dn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),dn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),dn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(dn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const dn=[new F,new F,new F,new F,new F,new F,new F,new F],Qt=new F,rs=new ts,hi=new F,fi=new F,di=new F,yn=new F,bn=new F,Wn=new F,ki=new F,as=new F,os=new F,Xn=new F;function hr(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Xn.fromArray(i,r);const o=s.x*Math.abs(Xn.x)+s.y*Math.abs(Xn.y)+s.z*Math.abs(Xn.z),l=e.dot(Xn),c=t.dot(Xn),u=n.dot(Xn);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>o)return!1}return!0}const fu=new ts,Gi=new F,fr=new F;class Ys{constructor(e=new F,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):fu.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Gi.subVectors(e,this.center);const t=Gi.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Gi,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(fr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Gi.copy(e.center).add(fr)),this.expandByPoint(Gi.copy(e.center).sub(fr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const pn=new F,dr=new F,ls=new F,Tn=new F,pr=new F,cs=new F,mr=new F;class sa{constructor(e=new F,t=new F(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,pn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=pn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(pn.copy(this.origin).addScaledVector(this.direction,t),pn.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){dr.copy(e).add(t).multiplyScalar(.5),ls.copy(t).sub(e).normalize(),Tn.copy(this.origin).sub(dr);const r=e.distanceTo(t)*.5,a=-this.direction.dot(ls),o=Tn.dot(this.direction),l=-Tn.dot(ls),c=Tn.lengthSq(),u=Math.abs(1-a*a);let h,f,m,_;if(u>0)if(h=a*l-o,f=a*o-l,_=r*u,h>=0)if(f>=-_)if(f<=_){const g=1/u;h*=g,f*=g,m=h*(h+a*f+2*o)+f*(a*h+f+2*l)+c}else f=r,h=Math.max(0,-(a*f+o)),m=-h*h+f*(f+2*l)+c;else f=-r,h=Math.max(0,-(a*f+o)),m=-h*h+f*(f+2*l)+c;else f<=-_?(h=Math.max(0,-(-a*r+o)),f=h>0?-r:Math.min(Math.max(-r,-l),r),m=-h*h+f*(f+2*l)+c):f<=_?(h=0,f=Math.min(Math.max(-r,-l),r),m=f*(f+2*l)+c):(h=Math.max(0,-(a*r+o)),f=h>0?r:Math.min(Math.max(-r,-l),r),m=-h*h+f*(f+2*l)+c);else f=a>0?-r:r,h=Math.max(0,-(a*f+o)),m=-h*h+f*(f+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,h),s&&s.copy(dr).addScaledVector(ls,f),m}intersectSphere(e,t){pn.subVectors(e.center,this.origin);const n=pn.dot(this.direction),s=pn.dot(pn)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,f=this.origin;return c>=0?(n=(e.min.x-f.x)*c,s=(e.max.x-f.x)*c):(n=(e.max.x-f.x)*c,s=(e.min.x-f.x)*c),u>=0?(r=(e.min.y-f.y)*u,a=(e.max.y-f.y)*u):(r=(e.max.y-f.y)*u,a=(e.min.y-f.y)*u),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),h>=0?(o=(e.min.z-f.z)*h,l=(e.max.z-f.z)*h):(o=(e.max.z-f.z)*h,l=(e.min.z-f.z)*h),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,pn)!==null}intersectTriangle(e,t,n,s,r){pr.subVectors(t,e),cs.subVectors(n,e),mr.crossVectors(pr,cs);let a=this.direction.dot(mr),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Tn.subVectors(this.origin,e);const l=o*this.direction.dot(cs.crossVectors(Tn,cs));if(l<0)return null;const c=o*this.direction.dot(pr.cross(Tn));if(c<0||l+c>a)return null;const u=-o*Tn.dot(mr);return u<0?null:this.at(u/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Mt{constructor(e,t,n,s,r,a,o,l,c,u,h,f,m,_,g,p){Mt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,u,h,f,m,_,g,p)}set(e,t,n,s,r,a,o,l,c,u,h,f,m,_,g,p){const d=this.elements;return d[0]=e,d[4]=t,d[8]=n,d[12]=s,d[1]=r,d[5]=a,d[9]=o,d[13]=l,d[2]=c,d[6]=u,d[10]=h,d[14]=f,d[3]=m,d[7]=_,d[11]=g,d[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Mt().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,s=1/pi.setFromMatrixColumn(e,0).length(),r=1/pi.setFromMatrixColumn(e,1).length(),a=1/pi.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),u=Math.cos(r),h=Math.sin(r);if(e.order==="XYZ"){const f=a*u,m=a*h,_=o*u,g=o*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=m+_*c,t[5]=f-g*c,t[9]=-o*l,t[2]=g-f*c,t[6]=_+m*c,t[10]=a*l}else if(e.order==="YXZ"){const f=l*u,m=l*h,_=c*u,g=c*h;t[0]=f+g*o,t[4]=_*o-m,t[8]=a*c,t[1]=a*h,t[5]=a*u,t[9]=-o,t[2]=m*o-_,t[6]=g+f*o,t[10]=a*l}else if(e.order==="ZXY"){const f=l*u,m=l*h,_=c*u,g=c*h;t[0]=f-g*o,t[4]=-a*h,t[8]=_+m*o,t[1]=m+_*o,t[5]=a*u,t[9]=g-f*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const f=a*u,m=a*h,_=o*u,g=o*h;t[0]=l*u,t[4]=_*c-m,t[8]=f*c+g,t[1]=l*h,t[5]=g*c+f,t[9]=m*c-_,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const f=a*l,m=a*c,_=o*l,g=o*c;t[0]=l*u,t[4]=g-f*h,t[8]=_*h+m,t[1]=h,t[5]=a*u,t[9]=-o*u,t[2]=-c*u,t[6]=m*h+_,t[10]=f-g*h}else if(e.order==="XZY"){const f=a*l,m=a*c,_=o*l,g=o*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=f*h+g,t[5]=a*u,t[9]=m*h-_,t[2]=_*h-m,t[6]=o*u,t[10]=g*h+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(du,e,pu)}lookAt(e,t,n){const s=this.elements;return Gt.subVectors(e,t),Gt.lengthSq()===0&&(Gt.z=1),Gt.normalize(),An.crossVectors(n,Gt),An.lengthSq()===0&&(Math.abs(n.z)===1?Gt.x+=1e-4:Gt.z+=1e-4,Gt.normalize(),An.crossVectors(n,Gt)),An.normalize(),us.crossVectors(Gt,An),s[0]=An.x,s[4]=us.x,s[8]=Gt.x,s[1]=An.y,s[5]=us.y,s[9]=Gt.y,s[2]=An.z,s[6]=us.z,s[10]=Gt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],u=n[1],h=n[5],f=n[9],m=n[13],_=n[2],g=n[6],p=n[10],d=n[14],M=n[3],v=n[7],E=n[11],T=n[15],w=s[0],y=s[4],L=s[8],x=s[12],b=s[1],N=s[5],O=s[9],$=s[13],P=s[2],U=s[6],B=s[10],k=s[14],X=s[3],V=s[7],z=s[11],ne=s[15];return r[0]=a*w+o*b+l*P+c*X,r[4]=a*y+o*N+l*U+c*V,r[8]=a*L+o*O+l*B+c*z,r[12]=a*x+o*$+l*k+c*ne,r[1]=u*w+h*b+f*P+m*X,r[5]=u*y+h*N+f*U+m*V,r[9]=u*L+h*O+f*B+m*z,r[13]=u*x+h*$+f*k+m*ne,r[2]=_*w+g*b+p*P+d*X,r[6]=_*y+g*N+p*U+d*V,r[10]=_*L+g*O+p*B+d*z,r[14]=_*x+g*$+p*k+d*ne,r[3]=M*w+v*b+E*P+T*X,r[7]=M*y+v*N+E*U+T*V,r[11]=M*L+v*O+E*B+T*z,r[15]=M*x+v*$+E*k+T*ne,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],u=e[2],h=e[6],f=e[10],m=e[14],_=e[3],g=e[7],p=e[11],d=e[15];return _*(+r*l*h-s*c*h-r*o*f+n*c*f+s*o*m-n*l*m)+g*(+t*l*m-t*c*f+r*a*f-s*a*m+s*c*u-r*l*u)+p*(+t*c*h-t*o*m-r*a*h+n*a*m+r*o*u-n*c*u)+d*(-s*o*u-t*l*h+t*o*f+s*a*h-n*a*f+n*l*u)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=e[9],f=e[10],m=e[11],_=e[12],g=e[13],p=e[14],d=e[15],M=h*p*c-g*f*c+g*l*m-o*p*m-h*l*d+o*f*d,v=_*f*c-u*p*c-_*l*m+a*p*m+u*l*d-a*f*d,E=u*g*c-_*h*c+_*o*m-a*g*m-u*o*d+a*h*d,T=_*h*l-u*g*l-_*o*f+a*g*f+u*o*p-a*h*p,w=t*M+n*v+s*E+r*T;if(w===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const y=1/w;return e[0]=M*y,e[1]=(g*f*r-h*p*r-g*s*m+n*p*m+h*s*d-n*f*d)*y,e[2]=(o*p*r-g*l*r+g*s*c-n*p*c-o*s*d+n*l*d)*y,e[3]=(h*l*r-o*f*r-h*s*c+n*f*c+o*s*m-n*l*m)*y,e[4]=v*y,e[5]=(u*p*r-_*f*r+_*s*m-t*p*m-u*s*d+t*f*d)*y,e[6]=(_*l*r-a*p*r-_*s*c+t*p*c+a*s*d-t*l*d)*y,e[7]=(a*f*r-u*l*r+u*s*c-t*f*c-a*s*m+t*l*m)*y,e[8]=E*y,e[9]=(_*h*r-u*g*r-_*n*m+t*g*m+u*n*d-t*h*d)*y,e[10]=(a*g*r-_*o*r+_*n*c-t*g*c-a*n*d+t*o*d)*y,e[11]=(u*o*r-a*h*r-u*n*c+t*h*c+a*n*m-t*o*m)*y,e[12]=T*y,e[13]=(u*g*s-_*h*s+_*n*f-t*g*f-u*n*p+t*h*p)*y,e[14]=(_*o*s-a*g*s-_*n*l+t*g*l+a*n*p-t*o*p)*y,e[15]=(a*h*s-u*o*s+u*n*l-t*h*l-a*n*f+t*o*f)*y,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,u=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,u*o+n,u*l-s*a,0,c*l-s*o,u*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,u=a+a,h=o+o,f=r*c,m=r*u,_=r*h,g=a*u,p=a*h,d=o*h,M=l*c,v=l*u,E=l*h,T=n.x,w=n.y,y=n.z;return s[0]=(1-(g+d))*T,s[1]=(m+E)*T,s[2]=(_-v)*T,s[3]=0,s[4]=(m-E)*w,s[5]=(1-(f+d))*w,s[6]=(p+M)*w,s[7]=0,s[8]=(_+v)*y,s[9]=(p-M)*y,s[10]=(1-(f+g))*y,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;let r=pi.set(s[0],s[1],s[2]).length();const a=pi.set(s[4],s[5],s[6]).length(),o=pi.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),e.x=s[12],e.y=s[13],e.z=s[14],$t.copy(this);const c=1/r,u=1/a,h=1/o;return $t.elements[0]*=c,$t.elements[1]*=c,$t.elements[2]*=c,$t.elements[4]*=u,$t.elements[5]*=u,$t.elements[6]*=u,$t.elements[8]*=h,$t.elements[9]*=h,$t.elements[10]*=h,t.setFromRotationMatrix($t),n.x=r,n.y=a,n.z=o,this}makePerspective(e,t,n,s,r,a,o=Mn){const l=this.elements,c=2*r/(t-e),u=2*r/(n-s),h=(t+e)/(t-e),f=(n+s)/(n-s);let m,_;if(o===Mn)m=-(a+r)/(a-r),_=-2*a*r/(a-r);else if(o===Bs)m=-a/(a-r),_=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=u,l[9]=f,l[13]=0,l[2]=0,l[6]=0,l[10]=m,l[14]=_,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=Mn){const l=this.elements,c=1/(t-e),u=1/(n-s),h=1/(a-r),f=(t+e)*c,m=(n+s)*u;let _,g;if(o===Mn)_=(a+r)*h,g=-2*h;else if(o===Bs)_=r*h,g=-1*h;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-f,l[1]=0,l[5]=2*u,l[9]=0,l[13]=-m,l[2]=0,l[6]=0,l[10]=g,l[14]=-_,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const pi=new F,$t=new Mt,du=new F(0,0,0),pu=new F(1,1,1),An=new F,us=new F,Gt=new F,eo=new Mt,to=new ni;class js{constructor(e=0,t=0,n=0,s=js.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],u=s[9],h=s[2],f=s[6],m=s[10];switch(t){case"XYZ":this._y=Math.asin(Dt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,m),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Dt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,m),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,r),this._z=0);break;case"ZXY":this._x=Math.asin(Dt(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-h,m),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Dt(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(f,m),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Dt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,r)):(this._x=0,this._y=Math.atan2(o,m));break;case"XZY":this._z=Math.asin(-Dt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-u,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return eo.makeRotationFromQuaternion(e),this.setFromRotationMatrix(eo,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return to.setFromEuler(this),this.setFromQuaternion(to,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}js.DEFAULT_ORDER="XYZ";class Dl{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let mu=0;const no=new F,mi=new ni,mn=new Mt,hs=new F,Vi=new F,_u=new F,gu=new ni,io=new F(1,0,0),so=new F(0,1,0),ro=new F(0,0,1),vu={type:"added"},xu={type:"removed"};class Rt extends ri{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:mu++}),this.uuid=es(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Rt.DEFAULT_UP.clone();const e=new F,t=new js,n=new ni,s=new F(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Mt},normalMatrix:{value:new nt}}),this.matrix=new Mt,this.matrixWorld=new Mt,this.matrixAutoUpdate=Rt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Dl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return mi.setFromAxisAngle(e,t),this.quaternion.multiply(mi),this}rotateOnWorldAxis(e,t){return mi.setFromAxisAngle(e,t),this.quaternion.premultiply(mi),this}rotateX(e){return this.rotateOnAxis(io,e)}rotateY(e){return this.rotateOnAxis(so,e)}rotateZ(e){return this.rotateOnAxis(ro,e)}translateOnAxis(e,t){return no.copy(e).applyQuaternion(this.quaternion),this.position.add(no.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(io,e)}translateY(e){return this.translateOnAxis(so,e)}translateZ(e){return this.translateOnAxis(ro,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(mn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?hs.copy(e):hs.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Vi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?mn.lookAt(Vi,hs,this.up):mn.lookAt(hs,Vi,this.up),this.quaternion.setFromRotationMatrix(mn),s&&(mn.extractRotation(s.matrixWorld),mi.setFromRotationMatrix(mn),this.quaternion.premultiply(mi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.parent!==null&&e.parent.remove(e),e.parent=this,this.children.push(e),e.dispatchEvent(vu)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(xu)),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),mn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),mn.multiply(e.parent.matrixWorld)),e.applyMatrix4(mn),this.add(e),e.updateWorldMatrix(!1,!0),this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Vi,e,_u),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Vi,gu,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++){const r=t[n];(r.matrixWorldAutoUpdate===!0||e===!0)&&r.updateMatrixWorld(e)}}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){const s=this.children;for(let r=0,a=s.length;r<a;r++){const o=s[r];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),s.maxGeometryCount=this._maxGeometryCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(e),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const h=l[c];r(e.shapes,h)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),u=a(e.images),h=a(e.shapes),f=a(e.skeletons),m=a(e.animations),_=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),u.length>0&&(n.images=u),h.length>0&&(n.shapes=h),f.length>0&&(n.skeletons=f),m.length>0&&(n.animations=m),_.length>0&&(n.nodes=_)}return n.object=s,n;function a(o){const l=[];for(const c in o){const u=o[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}Rt.DEFAULT_UP=new F(0,1,0);Rt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const en=new F,_n=new F,_r=new F,gn=new F,_i=new F,gi=new F,ao=new F,gr=new F,vr=new F,xr=new F;let fs=!1;class Kt{constructor(e=new F,t=new F,n=new F){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),en.subVectors(e,t),s.cross(en);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){en.subVectors(s,t),_n.subVectors(n,t),_r.subVectors(e,t);const a=en.dot(en),o=en.dot(_n),l=en.dot(_r),c=_n.dot(_n),u=_n.dot(_r),h=a*c-o*o;if(h===0)return r.set(0,0,0),null;const f=1/h,m=(c*l-o*u)*f,_=(a*u-o*l)*f;return r.set(1-m-_,_,m)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,gn)===null?!1:gn.x>=0&&gn.y>=0&&gn.x+gn.y<=1}static getUV(e,t,n,s,r,a,o,l){return fs===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),fs=!0),this.getInterpolation(e,t,n,s,r,a,o,l)}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,gn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,gn.x),l.addScaledVector(a,gn.y),l.addScaledVector(o,gn.z),l)}static isFrontFacing(e,t,n,s){return en.subVectors(n,t),_n.subVectors(e,t),en.cross(_n).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return en.subVectors(this.c,this.b),_n.subVectors(this.a,this.b),en.cross(_n).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Kt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Kt.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,n,s,r){return fs===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),fs=!0),Kt.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}getInterpolation(e,t,n,s,r){return Kt.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return Kt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Kt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;_i.subVectors(s,n),gi.subVectors(r,n),gr.subVectors(e,n);const l=_i.dot(gr),c=gi.dot(gr);if(l<=0&&c<=0)return t.copy(n);vr.subVectors(e,s);const u=_i.dot(vr),h=gi.dot(vr);if(u>=0&&h<=u)return t.copy(s);const f=l*h-u*c;if(f<=0&&l>=0&&u<=0)return a=l/(l-u),t.copy(n).addScaledVector(_i,a);xr.subVectors(e,r);const m=_i.dot(xr),_=gi.dot(xr);if(_>=0&&m<=_)return t.copy(r);const g=m*c-l*_;if(g<=0&&c>=0&&_<=0)return o=c/(c-_),t.copy(n).addScaledVector(gi,o);const p=u*_-m*h;if(p<=0&&h-u>=0&&m-_>=0)return ao.subVectors(r,s),o=(h-u)/(h-u+(m-_)),t.copy(s).addScaledVector(ao,o);const d=1/(p+g+f);return a=g*d,o=f*d,t.copy(n).addScaledVector(_i,a).addScaledVector(gi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Il={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},wn={h:0,s:0,l:0},ds={h:0,s:0,l:0};function Mr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class it{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=wt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,ut.toWorkingColorSpace(this,t),this}setRGB(e,t,n,s=ut.workingColorSpace){return this.r=e,this.g=t,this.b=n,ut.toWorkingColorSpace(this,s),this}setHSL(e,t,n,s=ut.workingColorSpace){if(e=su(e,1),t=Dt(t,0,1),n=Dt(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Mr(a,r,e+1/3),this.g=Mr(a,r,e),this.b=Mr(a,r,e-1/3)}return ut.toWorkingColorSpace(this,s),this}setStyle(e,t=wt){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=wt){const n=Il[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Ci(e.r),this.g=Ci(e.g),this.b=Ci(e.b),this}copyLinearToSRGB(e){return this.r=lr(e.r),this.g=lr(e.g),this.b=lr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=wt){return ut.fromWorkingColorSpace(Lt.copy(this),e),Math.round(Dt(Lt.r*255,0,255))*65536+Math.round(Dt(Lt.g*255,0,255))*256+Math.round(Dt(Lt.b*255,0,255))}getHexString(e=wt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=ut.workingColorSpace){ut.fromWorkingColorSpace(Lt.copy(this),t);const n=Lt.r,s=Lt.g,r=Lt.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const u=(o+a)/2;if(o===a)l=0,c=0;else{const h=a-o;switch(c=u<=.5?h/(a+o):h/(2-a-o),a){case n:l=(s-r)/h+(s<r?6:0);break;case s:l=(r-n)/h+2;break;case r:l=(n-s)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=ut.workingColorSpace){return ut.fromWorkingColorSpace(Lt.copy(this),t),e.r=Lt.r,e.g=Lt.g,e.b=Lt.b,e}getStyle(e=wt){ut.fromWorkingColorSpace(Lt.copy(this),e);const t=Lt.r,n=Lt.g,s=Lt.b;return e!==wt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(wn),this.setHSL(wn.h+e,wn.s+t,wn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(wn),e.getHSL(ds);const n=ar(wn.h,ds.h,t),s=ar(wn.s,ds.s,t),r=ar(wn.l,ds.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Lt=new it;it.NAMES=Il;let Mu=0;class Fi extends ri{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Mu++}),this.uuid=es(),this.name="",this.type="Material",this.blending=Ri,this.side=Bn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=kr,this.blendDst=Gr,this.blendEquation=Kn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new it(0,0,0),this.blendAlpha=0,this.depthFunc=Us,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=qa,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ci,this.stencilZFail=ci,this.stencilZPass=ci,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Ri&&(n.blending=this.blending),this.side!==Bn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==kr&&(n.blendSrc=this.blendSrc),this.blendDst!==Gr&&(n.blendDst=this.blendDst),this.blendEquation!==Kn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Us&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==qa&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ci&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ci&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ci&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class Ul extends Fi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new it(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=ml,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const St=new F,ps=new qe;class hn{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Ya,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=Un,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ps.fromBufferAttribute(this,t),ps.applyMatrix3(e),this.setXY(t,ps.x,ps.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyMatrix3(e),this.setXYZ(t,St.x,St.y,St.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyMatrix4(e),this.setXYZ(t,St.x,St.y,St.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyNormalMatrix(e),this.setXYZ(t,St.x,St.y,St.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.transformDirection(e),this.setXYZ(t,St.x,St.y,St.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Hi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=zt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Hi(t,this.array)),t}setX(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Hi(t,this.array)),t}setY(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Hi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Hi(t,this.array)),t}setW(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=zt(t,this.array),n=zt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=zt(t,this.array),n=zt(n,this.array),s=zt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=zt(t,this.array),n=zt(n,this.array),s=zt(s,this.array),r=zt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Ya&&(e.usage=this.usage),e}}class Nl extends hn{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Fl extends hn{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class Bt extends hn{constructor(e,t,n){super(new Float32Array(e),t,n)}}let Su=0;const Yt=new Mt,Sr=new Rt,vi=new F,Vt=new ts,Wi=new ts,At=new F;class sn extends ri{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Su++}),this.uuid=es(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Rl(e)?Fl:Nl)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new nt().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Yt.makeRotationFromQuaternion(e),this.applyMatrix4(Yt),this}rotateX(e){return Yt.makeRotationX(e),this.applyMatrix4(Yt),this}rotateY(e){return Yt.makeRotationY(e),this.applyMatrix4(Yt),this}rotateZ(e){return Yt.makeRotationZ(e),this.applyMatrix4(Yt),this}translate(e,t,n){return Yt.makeTranslation(e,t,n),this.applyMatrix4(Yt),this}scale(e,t,n){return Yt.makeScale(e,t,n),this.applyMatrix4(Yt),this}lookAt(e){return Sr.lookAt(e),Sr.updateMatrix(),this.applyMatrix4(Sr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(vi).negate(),this.translate(vi.x,vi.y,vi.z),this}setFromPoints(e){const t=[];for(let n=0,s=e.length;n<s;n++){const r=e[n];t.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new Bt(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ts);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new F(-1/0,-1/0,-1/0),new F(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];Vt.setFromBufferAttribute(r),this.morphTargetsRelative?(At.addVectors(this.boundingBox.min,Vt.min),this.boundingBox.expandByPoint(At),At.addVectors(this.boundingBox.max,Vt.max),this.boundingBox.expandByPoint(At)):(this.boundingBox.expandByPoint(Vt.min),this.boundingBox.expandByPoint(Vt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ys);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new F,1/0);return}if(e){const n=this.boundingSphere.center;if(Vt.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];Wi.setFromBufferAttribute(o),this.morphTargetsRelative?(At.addVectors(Vt.min,Wi.min),Vt.expandByPoint(At),At.addVectors(Vt.max,Wi.max),Vt.expandByPoint(At)):(Vt.expandByPoint(Wi.min),Vt.expandByPoint(Wi.max))}Vt.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)At.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(At));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,u=o.count;c<u;c++)At.fromBufferAttribute(o,c),l&&(vi.fromBufferAttribute(e,c),At.add(vi)),s=Math.max(s,n.distanceToSquared(At))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.array,s=t.position.array,r=t.normal.array,a=t.uv.array,o=s.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new hn(new Float32Array(4*o),4));const l=this.getAttribute("tangent").array,c=[],u=[];for(let b=0;b<o;b++)c[b]=new F,u[b]=new F;const h=new F,f=new F,m=new F,_=new qe,g=new qe,p=new qe,d=new F,M=new F;function v(b,N,O){h.fromArray(s,b*3),f.fromArray(s,N*3),m.fromArray(s,O*3),_.fromArray(a,b*2),g.fromArray(a,N*2),p.fromArray(a,O*2),f.sub(h),m.sub(h),g.sub(_),p.sub(_);const $=1/(g.x*p.y-p.x*g.y);isFinite($)&&(d.copy(f).multiplyScalar(p.y).addScaledVector(m,-g.y).multiplyScalar($),M.copy(m).multiplyScalar(g.x).addScaledVector(f,-p.x).multiplyScalar($),c[b].add(d),c[N].add(d),c[O].add(d),u[b].add(M),u[N].add(M),u[O].add(M))}let E=this.groups;E.length===0&&(E=[{start:0,count:n.length}]);for(let b=0,N=E.length;b<N;++b){const O=E[b],$=O.start,P=O.count;for(let U=$,B=$+P;U<B;U+=3)v(n[U+0],n[U+1],n[U+2])}const T=new F,w=new F,y=new F,L=new F;function x(b){y.fromArray(r,b*3),L.copy(y);const N=c[b];T.copy(N),T.sub(y.multiplyScalar(y.dot(N))).normalize(),w.crossVectors(L,N);const $=w.dot(u[b])<0?-1:1;l[b*4]=T.x,l[b*4+1]=T.y,l[b*4+2]=T.z,l[b*4+3]=$}for(let b=0,N=E.length;b<N;++b){const O=E[b],$=O.start,P=O.count;for(let U=$,B=$+P;U<B;U+=3)x(n[U+0]),x(n[U+1]),x(n[U+2])}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new hn(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,m=n.count;f<m;f++)n.setXYZ(f,0,0,0);const s=new F,r=new F,a=new F,o=new F,l=new F,c=new F,u=new F,h=new F;if(e)for(let f=0,m=e.count;f<m;f+=3){const _=e.getX(f+0),g=e.getX(f+1),p=e.getX(f+2);s.fromBufferAttribute(t,_),r.fromBufferAttribute(t,g),a.fromBufferAttribute(t,p),u.subVectors(a,r),h.subVectors(s,r),u.cross(h),o.fromBufferAttribute(n,_),l.fromBufferAttribute(n,g),c.fromBufferAttribute(n,p),o.add(u),l.add(u),c.add(u),n.setXYZ(_,o.x,o.y,o.z),n.setXYZ(g,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let f=0,m=t.count;f<m;f+=3)s.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),a.fromBufferAttribute(t,f+2),u.subVectors(a,r),h.subVectors(s,r),u.cross(h),n.setXYZ(f+0,u.x,u.y,u.z),n.setXYZ(f+1,u.x,u.y,u.z),n.setXYZ(f+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)At.fromBufferAttribute(e,t),At.normalize(),e.setXYZ(t,At.x,At.y,At.z)}toNonIndexed(){function e(o,l){const c=o.array,u=o.itemSize,h=o.normalized,f=new c.constructor(l.length*u);let m=0,_=0;for(let g=0,p=l.length;g<p;g++){o.isInterleavedBufferAttribute?m=l[g]*o.data.stride+o.offset:m=l[g]*u;for(let d=0;d<u;d++)f[_++]=c[m++]}return new hn(f,u,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new sn,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let u=0,h=c.length;u<h;u++){const f=c[u],m=e(f,n);l.push(m)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let h=0,f=c.length;h<f;h++){const m=c[h];u.push(m.toJSON(e.data))}u.length>0&&(s[l]=u,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone(t));const s=e.attributes;for(const c in s){const u=s[c];this.setAttribute(c,u.clone(t))}const r=e.morphAttributes;for(const c in r){const u=[],h=r[c];for(let f=0,m=h.length;f<m;f++)u.push(h[f].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,u=a.length;c<u;c++){const h=a[c];this.addGroup(h.start,h.count,h.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const oo=new Mt,qn=new sa,ms=new Ys,lo=new F,xi=new F,Mi=new F,Si=new F,Er=new F,_s=new F,gs=new qe,vs=new qe,xs=new qe,co=new F,uo=new F,ho=new F,Ms=new F,Ss=new F;class Jt extends Rt{constructor(e=new sn,t=new Ul){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){_s.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const u=o[l],h=r[l];u!==0&&(Er.fromBufferAttribute(h,e),a?_s.addScaledVector(Er,u):_s.addScaledVector(Er.sub(t),u))}t.add(_s)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ms.copy(n.boundingSphere),ms.applyMatrix4(r),qn.copy(e.ray).recast(e.near),!(ms.containsPoint(qn.origin)===!1&&(qn.intersectSphere(ms,lo)===null||qn.origin.distanceToSquared(lo)>(e.far-e.near)**2))&&(oo.copy(r).invert(),qn.copy(e.ray).applyMatrix4(oo),!(n.boundingBox!==null&&qn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,qn)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,u=r.attributes.uv1,h=r.attributes.normal,f=r.groups,m=r.drawRange;if(o!==null)if(Array.isArray(a))for(let _=0,g=f.length;_<g;_++){const p=f[_],d=a[p.materialIndex],M=Math.max(p.start,m.start),v=Math.min(o.count,Math.min(p.start+p.count,m.start+m.count));for(let E=M,T=v;E<T;E+=3){const w=o.getX(E),y=o.getX(E+1),L=o.getX(E+2);s=Es(this,d,e,n,c,u,h,w,y,L),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=p.materialIndex,t.push(s))}}else{const _=Math.max(0,m.start),g=Math.min(o.count,m.start+m.count);for(let p=_,d=g;p<d;p+=3){const M=o.getX(p),v=o.getX(p+1),E=o.getX(p+2);s=Es(this,a,e,n,c,u,h,M,v,E),s&&(s.faceIndex=Math.floor(p/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let _=0,g=f.length;_<g;_++){const p=f[_],d=a[p.materialIndex],M=Math.max(p.start,m.start),v=Math.min(l.count,Math.min(p.start+p.count,m.start+m.count));for(let E=M,T=v;E<T;E+=3){const w=E,y=E+1,L=E+2;s=Es(this,d,e,n,c,u,h,w,y,L),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=p.materialIndex,t.push(s))}}else{const _=Math.max(0,m.start),g=Math.min(l.count,m.start+m.count);for(let p=_,d=g;p<d;p+=3){const M=p,v=p+1,E=p+2;s=Es(this,a,e,n,c,u,h,M,v,E),s&&(s.faceIndex=Math.floor(p/3),t.push(s))}}}}function Eu(i,e,t,n,s,r,a,o){let l;if(e.side===Ht?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===Bn,o),l===null)return null;Ss.copy(o),Ss.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(Ss);return c<t.near||c>t.far?null:{distance:c,point:Ss.clone(),object:i}}function Es(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,xi),i.getVertexPosition(l,Mi),i.getVertexPosition(c,Si);const u=Eu(i,e,t,n,xi,Mi,Si,Ms);if(u){s&&(gs.fromBufferAttribute(s,o),vs.fromBufferAttribute(s,l),xs.fromBufferAttribute(s,c),u.uv=Kt.getInterpolation(Ms,xi,Mi,Si,gs,vs,xs,new qe)),r&&(gs.fromBufferAttribute(r,o),vs.fromBufferAttribute(r,l),xs.fromBufferAttribute(r,c),u.uv1=Kt.getInterpolation(Ms,xi,Mi,Si,gs,vs,xs,new qe),u.uv2=u.uv1),a&&(co.fromBufferAttribute(a,o),uo.fromBufferAttribute(a,l),ho.fromBufferAttribute(a,c),u.normal=Kt.getInterpolation(Ms,xi,Mi,Si,co,uo,ho,new F),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));const h={a:o,b:l,c,normal:new F,materialIndex:0};Kt.getNormal(xi,Mi,Si,h.normal),u.face=h}return u}class ii extends sn{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],u=[],h=[];let f=0,m=0;_("z","y","x",-1,-1,n,t,e,a,r,0),_("z","y","x",1,-1,n,t,-e,a,r,1),_("x","z","y",1,1,e,n,t,s,a,2),_("x","z","y",1,-1,e,n,-t,s,a,3),_("x","y","z",1,-1,e,t,n,s,r,4),_("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new Bt(c,3)),this.setAttribute("normal",new Bt(u,3)),this.setAttribute("uv",new Bt(h,2));function _(g,p,d,M,v,E,T,w,y,L,x){const b=E/y,N=T/L,O=E/2,$=T/2,P=w/2,U=y+1,B=L+1;let k=0,X=0;const V=new F;for(let z=0;z<B;z++){const ne=z*N-$;for(let _e=0;_e<U;_e++){const Y=_e*b-O;V[g]=Y*M,V[p]=ne*v,V[d]=P,c.push(V.x,V.y,V.z),V[g]=0,V[p]=0,V[d]=w>0?1:-1,u.push(V.x,V.y,V.z),h.push(_e/y),h.push(1-z/L),k+=1}}for(let z=0;z<L;z++)for(let ne=0;ne<y;ne++){const _e=f+ne+U*z,Y=f+ne+U*(z+1),ee=f+(ne+1)+U*(z+1),pe=f+(ne+1)+U*z;l.push(_e,Y,pe),l.push(Y,ee,pe),X+=6}o.addGroup(m,X,x),m+=X,f+=k}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ii(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Ui(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone():Array.isArray(s)?e[t][n]=s.slice():e[t][n]=s}}return e}function Nt(i){const e={};for(let t=0;t<i.length;t++){const n=Ui(i[t]);for(const s in n)e[s]=n[s]}return e}function yu(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Ol(i){return i.getRenderTarget()===null?i.outputColorSpace:ut.workingColorSpace}const bu={clone:Ui,merge:Nt};var Tu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Au=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class si extends Fi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Tu,this.fragmentShader=Au,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ui(e.uniforms),this.uniformsGroups=yu(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Bl extends Rt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Mt,this.projectionMatrix=new Mt,this.projectionMatrixInverse=new Mt,this.coordinateSystem=Mn}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}class Wt extends Bl{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=jr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(qi*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return jr*2*Math.atan(Math.tan(qi*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(qi*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const Ei=-90,yi=1;class wu extends Rt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Wt(Ei,yi,e,t);s.layers=this.layers,this.add(s);const r=new Wt(Ei,yi,e,t);r.layers=this.layers,this.add(r);const a=new Wt(Ei,yi,e,t);a.layers=this.layers,this.add(a);const o=new Wt(Ei,yi,e,t);o.layers=this.layers,this.add(o);const l=new Wt(Ei,yi,e,t);l.layers=this.layers,this.add(l);const c=new Wt(Ei,yi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===Mn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Bs)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,u]=this.children,h=e.getRenderTarget(),f=e.getActiveCubeFace(),m=e.getActiveMipmapLevel(),_=e.xr.enabled;e.xr.enabled=!1;const g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,s),e.render(t,r),e.setRenderTarget(n,1,s),e.render(t,a),e.setRenderTarget(n,2,s),e.render(t,o),e.setRenderTarget(n,3,s),e.render(t,l),e.setRenderTarget(n,4,s),e.render(t,c),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,s),e.render(t,u),e.setRenderTarget(h,f,m),e.xr.enabled=_,n.texture.needsPMREMUpdate=!0}}class zl extends Xt{constructor(e,t,n,s,r,a,o,l,c,u){e=e!==void 0?e:[],t=t!==void 0?t:Li,super(e,t,n,s,r,a,o,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Ru extends ti{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];t.encoding!==void 0&&(Yi("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),t.colorSpace=t.encoding===ei?wt:Zt),this.texture=new zl(s,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:jt}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new ii(5,5,5),r=new si({name:"CubemapFromEquirect",uniforms:Ui(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ht,blending:Nn});r.uniforms.tEquirect.value=t;const a=new Jt(s,r),o=t.minFilter;return t.minFilter===Qi&&(t.minFilter=jt),new wu(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t,n,s){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}const yr=new F,Cu=new F,Pu=new nt;class Rn{constructor(e=new F(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=yr.subVectors(n,t).cross(Cu.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(yr),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Pu.getNormalMatrix(e),s=this.coplanarPoint(yr).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Yn=new Ys,ys=new F;class ra{constructor(e=new Rn,t=new Rn,n=new Rn,s=new Rn,r=new Rn,a=new Rn){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Mn){const n=this.planes,s=e.elements,r=s[0],a=s[1],o=s[2],l=s[3],c=s[4],u=s[5],h=s[6],f=s[7],m=s[8],_=s[9],g=s[10],p=s[11],d=s[12],M=s[13],v=s[14],E=s[15];if(n[0].setComponents(l-r,f-c,p-m,E-d).normalize(),n[1].setComponents(l+r,f+c,p+m,E+d).normalize(),n[2].setComponents(l+a,f+u,p+_,E+M).normalize(),n[3].setComponents(l-a,f-u,p-_,E-M).normalize(),n[4].setComponents(l-o,f-h,p-g,E-v).normalize(),t===Mn)n[5].setComponents(l+o,f+h,p+g,E+v).normalize();else if(t===Bs)n[5].setComponents(o,h,g,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Yn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Yn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Yn)}intersectsSprite(e){return Yn.center.set(0,0,0),Yn.radius=.7071067811865476,Yn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Yn)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(ys.x=s.normal.x>0?e.max.x:e.min.x,ys.y=s.normal.y>0?e.max.y:e.min.y,ys.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(ys)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Hl(){let i=null,e=!1,t=null,n=null;function s(r,a){t(r,a),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function Lu(i,e){const t=e.isWebGL2,n=new WeakMap;function s(c,u){const h=c.array,f=c.usage,m=h.byteLength,_=i.createBuffer();i.bindBuffer(u,_),i.bufferData(u,h,f),c.onUploadCallback();let g;if(h instanceof Float32Array)g=i.FLOAT;else if(h instanceof Uint16Array)if(c.isFloat16BufferAttribute)if(t)g=i.HALF_FLOAT;else throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");else g=i.UNSIGNED_SHORT;else if(h instanceof Int16Array)g=i.SHORT;else if(h instanceof Uint32Array)g=i.UNSIGNED_INT;else if(h instanceof Int32Array)g=i.INT;else if(h instanceof Int8Array)g=i.BYTE;else if(h instanceof Uint8Array)g=i.UNSIGNED_BYTE;else if(h instanceof Uint8ClampedArray)g=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+h);return{buffer:_,type:g,bytesPerElement:h.BYTES_PER_ELEMENT,version:c.version,size:m}}function r(c,u,h){const f=u.array,m=u._updateRange,_=u.updateRanges;if(i.bindBuffer(h,c),m.count===-1&&_.length===0&&i.bufferSubData(h,0,f),_.length!==0){for(let g=0,p=_.length;g<p;g++){const d=_[g];t?i.bufferSubData(h,d.start*f.BYTES_PER_ELEMENT,f,d.start,d.count):i.bufferSubData(h,d.start*f.BYTES_PER_ELEMENT,f.subarray(d.start,d.start+d.count))}u.clearUpdateRanges()}m.count!==-1&&(t?i.bufferSubData(h,m.offset*f.BYTES_PER_ELEMENT,f,m.offset,m.count):i.bufferSubData(h,m.offset*f.BYTES_PER_ELEMENT,f.subarray(m.offset,m.offset+m.count)),m.count=-1),u.onUploadCallback()}function a(c){return c.isInterleavedBufferAttribute&&(c=c.data),n.get(c)}function o(c){c.isInterleavedBufferAttribute&&(c=c.data);const u=n.get(c);u&&(i.deleteBuffer(u.buffer),n.delete(c))}function l(c,u){if(c.isGLBufferAttribute){const f=n.get(c);(!f||f.version<c.version)&&n.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);const h=n.get(c);if(h===void 0)n.set(c,s(c,u));else if(h.version<c.version){if(h.size!==c.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");r(h.buffer,c,u),h.version=c.version}}return{get:a,remove:o,update:l}}class aa extends sn{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,u=l+1,h=e/o,f=t/l,m=[],_=[],g=[],p=[];for(let d=0;d<u;d++){const M=d*f-a;for(let v=0;v<c;v++){const E=v*h-r;_.push(E,-M,0),g.push(0,0,1),p.push(v/o),p.push(1-d/l)}}for(let d=0;d<l;d++)for(let M=0;M<o;M++){const v=M+c*d,E=M+c*(d+1),T=M+1+c*(d+1),w=M+1+c*d;m.push(v,E,w),m.push(E,T,w)}this.setIndex(m),this.setAttribute("position",new Bt(_,3)),this.setAttribute("normal",new Bt(g,3)),this.setAttribute("uv",new Bt(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new aa(e.width,e.height,e.widthSegments,e.heightSegments)}}var Du=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Iu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Uu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Nu=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Fu=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,Ou=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Bu=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,zu=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Hu=`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,ku=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,Gu=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Vu=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Wu=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Xu=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,qu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Yu=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,ju=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ku=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Zu=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Ju=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Qu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,$u=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,eh=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,th=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,nh=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,ih=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,sh=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,rh=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,ah=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,oh=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,lh="gl_FragColor = linearToOutputTexel( gl_FragColor );",ch=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,uh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,hh=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,fh=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,dh=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ph=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,mh=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,_h=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,gh=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,vh=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,xh=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Mh=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,Sh=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Eh=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,yh=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,bh=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Th=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Ah=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,wh=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Rh=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Ch=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Ph=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Lh=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Dh=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Ih=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Uh=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Nh=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Fh=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Oh=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,Bh=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,zh=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Hh=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,kh=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Gh=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Vh=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Wh=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Xh=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,qh=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,Yh=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,jh=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,Kh=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Zh=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Jh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Qh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,$h=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,ef=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,tf=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,nf=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,sf=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,rf=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,af=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,of=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,lf=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,cf=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,uf=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,hf=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,ff=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,df=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,pf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,mf=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,_f=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,gf=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,vf=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,xf=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Mf=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Sf=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Ef=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,yf=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,bf=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Tf=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color *= toneMappingExposure;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return color;
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Af=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,wf=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
		vec3 refractedRayExit = position + transmissionRay;
		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
		vec2 refractionCoords = ndcPos.xy / ndcPos.w;
		refractionCoords += 1.0;
		refractionCoords /= 2.0;
		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Rf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Cf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Pf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Lf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Df=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,If=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Uf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Nf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ff=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Of=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Bf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,zf=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,Hf=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,kf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Gf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Vf=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Wf=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Xf=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,qf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Yf=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,jf=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Kf=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Zf=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Jf=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Qf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,$f=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,ed=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,td=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,nd=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,id=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,sd=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,rd=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ad=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,od=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,ld=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,cd=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,ud=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,hd=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Qe={alphahash_fragment:Du,alphahash_pars_fragment:Iu,alphamap_fragment:Uu,alphamap_pars_fragment:Nu,alphatest_fragment:Fu,alphatest_pars_fragment:Ou,aomap_fragment:Bu,aomap_pars_fragment:zu,batching_pars_vertex:Hu,batching_vertex:ku,begin_vertex:Gu,beginnormal_vertex:Vu,bsdfs:Wu,iridescence_fragment:Xu,bumpmap_pars_fragment:qu,clipping_planes_fragment:Yu,clipping_planes_pars_fragment:ju,clipping_planes_pars_vertex:Ku,clipping_planes_vertex:Zu,color_fragment:Ju,color_pars_fragment:Qu,color_pars_vertex:$u,color_vertex:eh,common:th,cube_uv_reflection_fragment:nh,defaultnormal_vertex:ih,displacementmap_pars_vertex:sh,displacementmap_vertex:rh,emissivemap_fragment:ah,emissivemap_pars_fragment:oh,colorspace_fragment:lh,colorspace_pars_fragment:ch,envmap_fragment:uh,envmap_common_pars_fragment:hh,envmap_pars_fragment:fh,envmap_pars_vertex:dh,envmap_physical_pars_fragment:Th,envmap_vertex:ph,fog_vertex:mh,fog_pars_vertex:_h,fog_fragment:gh,fog_pars_fragment:vh,gradientmap_pars_fragment:xh,lightmap_fragment:Mh,lightmap_pars_fragment:Sh,lights_lambert_fragment:Eh,lights_lambert_pars_fragment:yh,lights_pars_begin:bh,lights_toon_fragment:Ah,lights_toon_pars_fragment:wh,lights_phong_fragment:Rh,lights_phong_pars_fragment:Ch,lights_physical_fragment:Ph,lights_physical_pars_fragment:Lh,lights_fragment_begin:Dh,lights_fragment_maps:Ih,lights_fragment_end:Uh,logdepthbuf_fragment:Nh,logdepthbuf_pars_fragment:Fh,logdepthbuf_pars_vertex:Oh,logdepthbuf_vertex:Bh,map_fragment:zh,map_pars_fragment:Hh,map_particle_fragment:kh,map_particle_pars_fragment:Gh,metalnessmap_fragment:Vh,metalnessmap_pars_fragment:Wh,morphcolor_vertex:Xh,morphnormal_vertex:qh,morphtarget_pars_vertex:Yh,morphtarget_vertex:jh,normal_fragment_begin:Kh,normal_fragment_maps:Zh,normal_pars_fragment:Jh,normal_pars_vertex:Qh,normal_vertex:$h,normalmap_pars_fragment:ef,clearcoat_normal_fragment_begin:tf,clearcoat_normal_fragment_maps:nf,clearcoat_pars_fragment:sf,iridescence_pars_fragment:rf,opaque_fragment:af,packing:of,premultiplied_alpha_fragment:lf,project_vertex:cf,dithering_fragment:uf,dithering_pars_fragment:hf,roughnessmap_fragment:ff,roughnessmap_pars_fragment:df,shadowmap_pars_fragment:pf,shadowmap_pars_vertex:mf,shadowmap_vertex:_f,shadowmask_pars_fragment:gf,skinbase_vertex:vf,skinning_pars_vertex:xf,skinning_vertex:Mf,skinnormal_vertex:Sf,specularmap_fragment:Ef,specularmap_pars_fragment:yf,tonemapping_fragment:bf,tonemapping_pars_fragment:Tf,transmission_fragment:Af,transmission_pars_fragment:wf,uv_pars_fragment:Rf,uv_pars_vertex:Cf,uv_vertex:Pf,worldpos_vertex:Lf,background_vert:Df,background_frag:If,backgroundCube_vert:Uf,backgroundCube_frag:Nf,cube_vert:Ff,cube_frag:Of,depth_vert:Bf,depth_frag:zf,distanceRGBA_vert:Hf,distanceRGBA_frag:kf,equirect_vert:Gf,equirect_frag:Vf,linedashed_vert:Wf,linedashed_frag:Xf,meshbasic_vert:qf,meshbasic_frag:Yf,meshlambert_vert:jf,meshlambert_frag:Kf,meshmatcap_vert:Zf,meshmatcap_frag:Jf,meshnormal_vert:Qf,meshnormal_frag:$f,meshphong_vert:ed,meshphong_frag:td,meshphysical_vert:nd,meshphysical_frag:id,meshtoon_vert:sd,meshtoon_frag:rd,points_vert:ad,points_frag:od,shadow_vert:ld,shadow_frag:cd,sprite_vert:ud,sprite_frag:hd},Me={common:{diffuse:{value:new it(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new nt},alphaMap:{value:null},alphaMapTransform:{value:new nt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new nt}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new nt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new nt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new nt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new nt},normalScale:{value:new qe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new nt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new nt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new nt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new nt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new it(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new it(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new nt},alphaTest:{value:0},uvTransform:{value:new nt}},sprite:{diffuse:{value:new it(16777215)},opacity:{value:1},center:{value:new qe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new nt},alphaMap:{value:null},alphaMapTransform:{value:new nt},alphaTest:{value:0}}},ln={basic:{uniforms:Nt([Me.common,Me.specularmap,Me.envmap,Me.aomap,Me.lightmap,Me.fog]),vertexShader:Qe.meshbasic_vert,fragmentShader:Qe.meshbasic_frag},lambert:{uniforms:Nt([Me.common,Me.specularmap,Me.envmap,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.fog,Me.lights,{emissive:{value:new it(0)}}]),vertexShader:Qe.meshlambert_vert,fragmentShader:Qe.meshlambert_frag},phong:{uniforms:Nt([Me.common,Me.specularmap,Me.envmap,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.fog,Me.lights,{emissive:{value:new it(0)},specular:{value:new it(1118481)},shininess:{value:30}}]),vertexShader:Qe.meshphong_vert,fragmentShader:Qe.meshphong_frag},standard:{uniforms:Nt([Me.common,Me.envmap,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.roughnessmap,Me.metalnessmap,Me.fog,Me.lights,{emissive:{value:new it(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Qe.meshphysical_vert,fragmentShader:Qe.meshphysical_frag},toon:{uniforms:Nt([Me.common,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.gradientmap,Me.fog,Me.lights,{emissive:{value:new it(0)}}]),vertexShader:Qe.meshtoon_vert,fragmentShader:Qe.meshtoon_frag},matcap:{uniforms:Nt([Me.common,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.fog,{matcap:{value:null}}]),vertexShader:Qe.meshmatcap_vert,fragmentShader:Qe.meshmatcap_frag},points:{uniforms:Nt([Me.points,Me.fog]),vertexShader:Qe.points_vert,fragmentShader:Qe.points_frag},dashed:{uniforms:Nt([Me.common,Me.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Qe.linedashed_vert,fragmentShader:Qe.linedashed_frag},depth:{uniforms:Nt([Me.common,Me.displacementmap]),vertexShader:Qe.depth_vert,fragmentShader:Qe.depth_frag},normal:{uniforms:Nt([Me.common,Me.bumpmap,Me.normalmap,Me.displacementmap,{opacity:{value:1}}]),vertexShader:Qe.meshnormal_vert,fragmentShader:Qe.meshnormal_frag},sprite:{uniforms:Nt([Me.sprite,Me.fog]),vertexShader:Qe.sprite_vert,fragmentShader:Qe.sprite_frag},background:{uniforms:{uvTransform:{value:new nt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Qe.background_vert,fragmentShader:Qe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:Qe.backgroundCube_vert,fragmentShader:Qe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Qe.cube_vert,fragmentShader:Qe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Qe.equirect_vert,fragmentShader:Qe.equirect_frag},distanceRGBA:{uniforms:Nt([Me.common,Me.displacementmap,{referencePosition:{value:new F},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Qe.distanceRGBA_vert,fragmentShader:Qe.distanceRGBA_frag},shadow:{uniforms:Nt([Me.lights,Me.fog,{color:{value:new it(0)},opacity:{value:1}}]),vertexShader:Qe.shadow_vert,fragmentShader:Qe.shadow_frag}};ln.physical={uniforms:Nt([ln.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new nt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new nt},clearcoatNormalScale:{value:new qe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new nt},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new nt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new nt},sheen:{value:0},sheenColor:{value:new it(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new nt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new nt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new nt},transmissionSamplerSize:{value:new qe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new nt},attenuationDistance:{value:0},attenuationColor:{value:new it(0)},specularColor:{value:new it(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new nt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new nt},anisotropyVector:{value:new qe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new nt}}]),vertexShader:Qe.meshphysical_vert,fragmentShader:Qe.meshphysical_frag};const bs={r:0,b:0,g:0};function fd(i,e,t,n,s,r,a){const o=new it(0);let l=r===!0?0:1,c,u,h=null,f=0,m=null;function _(p,d){let M=!1,v=d.isScene===!0?d.background:null;v&&v.isTexture&&(v=(d.backgroundBlurriness>0?t:e).get(v)),v===null?g(o,l):v&&v.isColor&&(g(v,1),M=!0);const E=i.xr.getEnvironmentBlendMode();E==="additive"?n.buffers.color.setClear(0,0,0,1,a):E==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||M)&&i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil),v&&(v.isCubeTexture||v.mapping===Xs)?(u===void 0&&(u=new Jt(new ii(1,1,1),new si({name:"BackgroundCubeMaterial",uniforms:Ui(ln.backgroundCube.uniforms),vertexShader:ln.backgroundCube.vertexShader,fragmentShader:ln.backgroundCube.fragmentShader,side:Ht,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(T,w,y){this.matrixWorld.copyPosition(y.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(u)),u.material.uniforms.envMap.value=v,u.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=d.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=d.backgroundIntensity,u.material.toneMapped=ut.getTransfer(v.colorSpace)!==ht,(h!==v||f!==v.version||m!==i.toneMapping)&&(u.material.needsUpdate=!0,h=v,f=v.version,m=i.toneMapping),u.layers.enableAll(),p.unshift(u,u.geometry,u.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new Jt(new aa(2,2),new si({name:"BackgroundMaterial",uniforms:Ui(ln.background.uniforms),vertexShader:ln.background.vertexShader,fragmentShader:ln.background.fragmentShader,side:Bn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=d.backgroundIntensity,c.material.toneMapped=ut.getTransfer(v.colorSpace)!==ht,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(h!==v||f!==v.version||m!==i.toneMapping)&&(c.material.needsUpdate=!0,h=v,f=v.version,m=i.toneMapping),c.layers.enableAll(),p.unshift(c,c.geometry,c.material,0,0,null))}function g(p,d){p.getRGB(bs,Ol(i)),n.buffers.color.setClear(bs.r,bs.g,bs.b,d,a)}return{getClearColor:function(){return o},setClearColor:function(p,d=1){o.set(p),l=d,g(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(p){l=p,g(o,l)},render:_}}function dd(i,e,t,n){const s=i.getParameter(i.MAX_VERTEX_ATTRIBS),r=n.isWebGL2?null:e.get("OES_vertex_array_object"),a=n.isWebGL2||r!==null,o={},l=p(null);let c=l,u=!1;function h(P,U,B,k,X){let V=!1;if(a){const z=g(k,B,U);c!==z&&(c=z,m(c.object)),V=d(P,k,B,X),V&&M(P,k,B,X)}else{const z=U.wireframe===!0;(c.geometry!==k.id||c.program!==B.id||c.wireframe!==z)&&(c.geometry=k.id,c.program=B.id,c.wireframe=z,V=!0)}X!==null&&t.update(X,i.ELEMENT_ARRAY_BUFFER),(V||u)&&(u=!1,L(P,U,B,k),X!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(X).buffer))}function f(){return n.isWebGL2?i.createVertexArray():r.createVertexArrayOES()}function m(P){return n.isWebGL2?i.bindVertexArray(P):r.bindVertexArrayOES(P)}function _(P){return n.isWebGL2?i.deleteVertexArray(P):r.deleteVertexArrayOES(P)}function g(P,U,B){const k=B.wireframe===!0;let X=o[P.id];X===void 0&&(X={},o[P.id]=X);let V=X[U.id];V===void 0&&(V={},X[U.id]=V);let z=V[k];return z===void 0&&(z=p(f()),V[k]=z),z}function p(P){const U=[],B=[],k=[];for(let X=0;X<s;X++)U[X]=0,B[X]=0,k[X]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:B,attributeDivisors:k,object:P,attributes:{},index:null}}function d(P,U,B,k){const X=c.attributes,V=U.attributes;let z=0;const ne=B.getAttributes();for(const _e in ne)if(ne[_e].location>=0){const ee=X[_e];let pe=V[_e];if(pe===void 0&&(_e==="instanceMatrix"&&P.instanceMatrix&&(pe=P.instanceMatrix),_e==="instanceColor"&&P.instanceColor&&(pe=P.instanceColor)),ee===void 0||ee.attribute!==pe||pe&&ee.data!==pe.data)return!0;z++}return c.attributesNum!==z||c.index!==k}function M(P,U,B,k){const X={},V=U.attributes;let z=0;const ne=B.getAttributes();for(const _e in ne)if(ne[_e].location>=0){let ee=V[_e];ee===void 0&&(_e==="instanceMatrix"&&P.instanceMatrix&&(ee=P.instanceMatrix),_e==="instanceColor"&&P.instanceColor&&(ee=P.instanceColor));const pe={};pe.attribute=ee,ee&&ee.data&&(pe.data=ee.data),X[_e]=pe,z++}c.attributes=X,c.attributesNum=z,c.index=k}function v(){const P=c.newAttributes;for(let U=0,B=P.length;U<B;U++)P[U]=0}function E(P){T(P,0)}function T(P,U){const B=c.newAttributes,k=c.enabledAttributes,X=c.attributeDivisors;B[P]=1,k[P]===0&&(i.enableVertexAttribArray(P),k[P]=1),X[P]!==U&&((n.isWebGL2?i:e.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](P,U),X[P]=U)}function w(){const P=c.newAttributes,U=c.enabledAttributes;for(let B=0,k=U.length;B<k;B++)U[B]!==P[B]&&(i.disableVertexAttribArray(B),U[B]=0)}function y(P,U,B,k,X,V,z){z===!0?i.vertexAttribIPointer(P,U,B,X,V):i.vertexAttribPointer(P,U,B,k,X,V)}function L(P,U,B,k){if(n.isWebGL2===!1&&(P.isInstancedMesh||k.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;v();const X=k.attributes,V=B.getAttributes(),z=U.defaultAttributeValues;for(const ne in V){const _e=V[ne];if(_e.location>=0){let Y=X[ne];if(Y===void 0&&(ne==="instanceMatrix"&&P.instanceMatrix&&(Y=P.instanceMatrix),ne==="instanceColor"&&P.instanceColor&&(Y=P.instanceColor)),Y!==void 0){const ee=Y.normalized,pe=Y.itemSize,oe=t.get(Y);if(oe===void 0)continue;const ue=oe.buffer,Pe=oe.type,Oe=oe.bytesPerElement,Ue=n.isWebGL2===!0&&(Pe===i.INT||Pe===i.UNSIGNED_INT||Y.gpuType===vl);if(Y.isInterleavedBufferAttribute){const He=Y.data,W=He.stride,lt=Y.offset;if(He.isInstancedInterleavedBuffer){for(let we=0;we<_e.locationSize;we++)T(_e.location+we,He.meshPerAttribute);P.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=He.meshPerAttribute*He.count)}else for(let we=0;we<_e.locationSize;we++)E(_e.location+we);i.bindBuffer(i.ARRAY_BUFFER,ue);for(let we=0;we<_e.locationSize;we++)y(_e.location+we,pe/_e.locationSize,Pe,ee,W*Oe,(lt+pe/_e.locationSize*we)*Oe,Ue)}else{if(Y.isInstancedBufferAttribute){for(let He=0;He<_e.locationSize;He++)T(_e.location+He,Y.meshPerAttribute);P.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=Y.meshPerAttribute*Y.count)}else for(let He=0;He<_e.locationSize;He++)E(_e.location+He);i.bindBuffer(i.ARRAY_BUFFER,ue);for(let He=0;He<_e.locationSize;He++)y(_e.location+He,pe/_e.locationSize,Pe,ee,pe*Oe,pe/_e.locationSize*He*Oe,Ue)}}else if(z!==void 0){const ee=z[ne];if(ee!==void 0)switch(ee.length){case 2:i.vertexAttrib2fv(_e.location,ee);break;case 3:i.vertexAttrib3fv(_e.location,ee);break;case 4:i.vertexAttrib4fv(_e.location,ee);break;default:i.vertexAttrib1fv(_e.location,ee)}}}}w()}function x(){O();for(const P in o){const U=o[P];for(const B in U){const k=U[B];for(const X in k)_(k[X].object),delete k[X];delete U[B]}delete o[P]}}function b(P){if(o[P.id]===void 0)return;const U=o[P.id];for(const B in U){const k=U[B];for(const X in k)_(k[X].object),delete k[X];delete U[B]}delete o[P.id]}function N(P){for(const U in o){const B=o[U];if(B[P.id]===void 0)continue;const k=B[P.id];for(const X in k)_(k[X].object),delete k[X];delete B[P.id]}}function O(){$(),u=!0,c!==l&&(c=l,m(c.object))}function $(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:h,reset:O,resetDefaultState:$,dispose:x,releaseStatesOfGeometry:b,releaseStatesOfProgram:N,initAttributes:v,enableAttribute:E,disableUnusedAttributes:w}}function pd(i,e,t,n){const s=n.isWebGL2;let r;function a(u){r=u}function o(u,h){i.drawArrays(r,u,h),t.update(h,r,1)}function l(u,h,f){if(f===0)return;let m,_;if(s)m=i,_="drawArraysInstanced";else if(m=e.get("ANGLE_instanced_arrays"),_="drawArraysInstancedANGLE",m===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}m[_](r,u,h,f),t.update(h,r,f)}function c(u,h,f){if(f===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let _=0;_<f;_++)this.render(u[_],h[_]);else{m.multiDrawArraysWEBGL(r,u,0,h,0,f);let _=0;for(let g=0;g<f;g++)_+=h[g];t.update(_,r,1)}}this.setMode=a,this.render=o,this.renderInstances=l,this.renderMultiDraw=c}function md(i,e,t){let n;function s(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){const y=e.get("EXT_texture_filter_anisotropic");n=i.getParameter(y.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function r(y){if(y==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";y="mediump"}return y==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const a=typeof WebGL2RenderingContext<"u"&&i.constructor.name==="WebGL2RenderingContext";let o=t.precision!==void 0?t.precision:"highp";const l=r(o);l!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",l,"instead."),o=l);const c=a||e.has("WEBGL_draw_buffers"),u=t.logarithmicDepthBuffer===!0,h=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),f=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),m=i.getParameter(i.MAX_TEXTURE_SIZE),_=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),g=i.getParameter(i.MAX_VERTEX_ATTRIBS),p=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),d=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),v=f>0,E=a||e.has("OES_texture_float"),T=v&&E,w=a?i.getParameter(i.MAX_SAMPLES):0;return{isWebGL2:a,drawBuffers:c,getMaxAnisotropy:s,getMaxPrecision:r,precision:o,logarithmicDepthBuffer:u,maxTextures:h,maxVertexTextures:f,maxTextureSize:m,maxCubemapSize:_,maxAttributes:g,maxVertexUniforms:p,maxVaryings:d,maxFragmentUniforms:M,vertexTextures:v,floatFragmentTextures:E,floatVertexTextures:T,maxSamples:w}}function _d(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new Rn,o=new nt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,f){const m=h.length!==0||f||n!==0||s;return s=f,n=h.length,m},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(h,f){t=u(h,f,0)},this.setState=function(h,f,m){const _=h.clippingPlanes,g=h.clipIntersection,p=h.clipShadows,d=i.get(h);if(!s||_===null||_.length===0||r&&!p)r?u(null):c();else{const M=r?0:n,v=M*4;let E=d.clippingState||null;l.value=E,E=u(_,f,v,m);for(let T=0;T!==v;++T)E[T]=t[T];d.clippingState=E,this.numIntersection=g?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function u(h,f,m,_){const g=h!==null?h.length:0;let p=null;if(g!==0){if(p=l.value,_!==!0||p===null){const d=m+g*4,M=f.matrixWorldInverse;o.getNormalMatrix(M),(p===null||p.length<d)&&(p=new Float32Array(d));for(let v=0,E=m;v!==g;++v,E+=4)a.copy(h[v]).applyMatrix4(M,o),a.normal.toArray(p,E),p[E+3]=a.constant}l.value=p,l.needsUpdate=!0}return e.numPlanes=g,e.numIntersection=0,p}}function gd(i){let e=new WeakMap;function t(a,o){return o===Vr?a.mapping=Li:o===Wr&&(a.mapping=Di),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===Vr||o===Wr)if(e.has(a)){const l=e.get(a).texture;return t(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new Ru(l.height/2);return c.fromEquirectangularTexture(i,a),e.set(a,c),a.addEventListener("dispose",s),t(c.texture,a.mapping)}else return null}}return a}function s(a){const o=a.target;o.removeEventListener("dispose",s);const l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}class kl extends Bl{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const Ai=4,fo=[.125,.215,.35,.446,.526,.582],Zn=20,br=new kl,po=new it;let Tr=null,Ar=0,wr=0;const jn=(1+Math.sqrt(5))/2,bi=1/jn,mo=[new F(1,1,1),new F(-1,1,1),new F(1,1,-1),new F(-1,1,-1),new F(0,jn,bi),new F(0,jn,-bi),new F(bi,0,jn),new F(-bi,0,jn),new F(jn,bi,0),new F(-jn,bi,0)];class _o{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,s=100){Tr=this._renderer.getRenderTarget(),Ar=this._renderer.getActiveCubeFace(),wr=this._renderer.getActiveMipmapLevel(),this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(e,n,s,r),t>0&&this._blur(r,0,0,t),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=xo(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=vo(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Tr,Ar,wr),e.scissorTest=!1,Ts(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Li||e.mapping===Di?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Tr=this._renderer.getRenderTarget(),Ar=this._renderer.getActiveCubeFace(),wr=this._renderer.getActiveMipmapLevel();const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:jt,minFilter:jt,generateMipmaps:!1,type:$i,format:nn,colorSpace:Sn,depthBuffer:!1},s=go(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=go(e,t,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=vd(r)),this._blurMaterial=xd(r,e,t)}return s}_compileMaterial(e){const t=new Jt(this._lodPlanes[0],e);this._renderer.compile(t,br)}_sceneToCubeUV(e,t,n,s){const o=new Wt(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],u=this._renderer,h=u.autoClear,f=u.toneMapping;u.getClearColor(po),u.toneMapping=Fn,u.autoClear=!1;const m=new Ul({name:"PMREM.Background",side:Ht,depthWrite:!1,depthTest:!1}),_=new Jt(new ii,m);let g=!1;const p=e.background;p?p.isColor&&(m.color.copy(p),e.background=null,g=!0):(m.color.copy(po),g=!0);for(let d=0;d<6;d++){const M=d%3;M===0?(o.up.set(0,l[d],0),o.lookAt(c[d],0,0)):M===1?(o.up.set(0,0,l[d]),o.lookAt(0,c[d],0)):(o.up.set(0,l[d],0),o.lookAt(0,0,c[d]));const v=this._cubeSize;Ts(s,M*v,d>2?v:0,v,v),u.setRenderTarget(s),g&&u.render(_,o),u.render(e,o)}_.geometry.dispose(),_.material.dispose(),u.toneMapping=f,u.autoClear=h,e.background=p}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Li||e.mapping===Di;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=xo()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=vo());const r=s?this._cubemapMaterial:this._equirectMaterial,a=new Jt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;Ts(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,br)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;for(let s=1;s<this._lodPlanes.length;s++){const r=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),a=mo[(s-1)%mo.length];this._blur(e,s-1,s,r,a)}t.autoClear=n}_blur(e,t,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,s,"latitudinal",r),this._halfBlur(a,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,h=new Jt(this._lodPlanes[s],c),f=c.uniforms,m=this._sizeLods[n]-1,_=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*Zn-1),g=r/_,p=isFinite(r)?1+Math.floor(u*g):Zn;p>Zn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${Zn}`);const d=[];let M=0;for(let y=0;y<Zn;++y){const L=y/g,x=Math.exp(-L*L/2);d.push(x),y===0?M+=x:y<p&&(M+=2*x)}for(let y=0;y<d.length;y++)d[y]=d[y]/M;f.envMap.value=e.texture,f.samples.value=p,f.weights.value=d,f.latitudinal.value=a==="latitudinal",o&&(f.poleAxis.value=o);const{_lodMax:v}=this;f.dTheta.value=_,f.mipInt.value=v-n;const E=this._sizeLods[s],T=3*E*(s>v-Ai?s-v+Ai:0),w=4*(this._cubeSize-E);Ts(t,T,w,3*E,2*E),l.setRenderTarget(t),l.render(h,br)}}function vd(i){const e=[],t=[],n=[];let s=i;const r=i-Ai+1+fo.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);t.push(o);let l=1/o;a>i-Ai?l=fo[a-i+Ai-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),u=-c,h=1+c,f=[u,u,h,u,h,h,u,u,h,h,u,h],m=6,_=6,g=3,p=2,d=1,M=new Float32Array(g*_*m),v=new Float32Array(p*_*m),E=new Float32Array(d*_*m);for(let w=0;w<m;w++){const y=w%3*2/3-1,L=w>2?0:-1,x=[y,L,0,y+2/3,L,0,y+2/3,L+1,0,y,L,0,y+2/3,L+1,0,y,L+1,0];M.set(x,g*_*w),v.set(f,p*_*w);const b=[w,w,w,w,w,w];E.set(b,d*_*w)}const T=new sn;T.setAttribute("position",new hn(M,g)),T.setAttribute("uv",new hn(v,p)),T.setAttribute("faceIndex",new hn(E,d)),e.push(T),s>Ai&&s--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function go(i,e,t){const n=new ti(i,e,t);return n.texture.mapping=Xs,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ts(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function xd(i,e,t){const n=new Float32Array(Zn),s=new F(0,1,0);return new si({name:"SphericalGaussianBlur",defines:{n:Zn,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:oa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Nn,depthTest:!1,depthWrite:!1})}function vo(){return new si({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:oa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Nn,depthTest:!1,depthWrite:!1})}function xo(){return new si({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:oa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Nn,depthTest:!1,depthWrite:!1})}function oa(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Md(i){let e=new WeakMap,t=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===Vr||l===Wr,u=l===Li||l===Di;if(c||u)if(o.isRenderTargetTexture&&o.needsPMREMUpdate===!0){o.needsPMREMUpdate=!1;let h=e.get(o);return t===null&&(t=new _o(i)),h=c?t.fromEquirectangular(o,h):t.fromCubemap(o,h),e.set(o,h),h.texture}else{if(e.has(o))return e.get(o).texture;{const h=o.image;if(c&&h&&h.height>0||u&&h&&s(h)){t===null&&(t=new _o(i));const f=c?t.fromEquirectangular(o):t.fromCubemap(o);return e.set(o,f),o.addEventListener("dispose",r),f.texture}else return null}}}return o}function s(o){let l=0;const c=6;for(let u=0;u<c;u++)o[u]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:a}}function Sd(i){const e={};function t(n){if(e[n]!==void 0)return e[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(n){n.isWebGL2?(t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance")):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture")},get:function(n){const s=t(n);return s===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Ed(i,e,t,n){const s={},r=new WeakMap;function a(h){const f=h.target;f.index!==null&&e.remove(f.index);for(const _ in f.attributes)e.remove(f.attributes[_]);for(const _ in f.morphAttributes){const g=f.morphAttributes[_];for(let p=0,d=g.length;p<d;p++)e.remove(g[p])}f.removeEventListener("dispose",a),delete s[f.id];const m=r.get(f);m&&(e.remove(m),r.delete(f)),n.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,t.memory.geometries--}function o(h,f){return s[f.id]===!0||(f.addEventListener("dispose",a),s[f.id]=!0,t.memory.geometries++),f}function l(h){const f=h.attributes;for(const _ in f)e.update(f[_],i.ARRAY_BUFFER);const m=h.morphAttributes;for(const _ in m){const g=m[_];for(let p=0,d=g.length;p<d;p++)e.update(g[p],i.ARRAY_BUFFER)}}function c(h){const f=[],m=h.index,_=h.attributes.position;let g=0;if(m!==null){const M=m.array;g=m.version;for(let v=0,E=M.length;v<E;v+=3){const T=M[v+0],w=M[v+1],y=M[v+2];f.push(T,w,w,y,y,T)}}else if(_!==void 0){const M=_.array;g=_.version;for(let v=0,E=M.length/3-1;v<E;v+=3){const T=v+0,w=v+1,y=v+2;f.push(T,w,w,y,y,T)}}else return;const p=new(Rl(f)?Fl:Nl)(f,1);p.version=g;const d=r.get(h);d&&e.remove(d),r.set(h,p)}function u(h){const f=r.get(h);if(f){const m=h.index;m!==null&&f.version<m.version&&c(h)}else c(h);return r.get(h)}return{get:o,update:l,getWireframeAttribute:u}}function yd(i,e,t,n){const s=n.isWebGL2;let r;function a(m){r=m}let o,l;function c(m){o=m.type,l=m.bytesPerElement}function u(m,_){i.drawElements(r,_,o,m*l),t.update(_,r,1)}function h(m,_,g){if(g===0)return;let p,d;if(s)p=i,d="drawElementsInstanced";else if(p=e.get("ANGLE_instanced_arrays"),d="drawElementsInstancedANGLE",p===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}p[d](r,_,o,m*l,g),t.update(_,r,g)}function f(m,_,g){if(g===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let d=0;d<g;d++)this.render(m[d]/l,_[d]);else{p.multiDrawElementsWEBGL(r,_,0,o,m,0,g);let d=0;for(let M=0;M<g;M++)d+=_[M];t.update(d,r,1)}}this.setMode=a,this.setIndex=c,this.render=u,this.renderInstances=h,this.renderMultiDraw=f}function bd(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function Td(i,e){return i[0]-e[0]}function Ad(i,e){return Math.abs(e[1])-Math.abs(i[1])}function wd(i,e,t){const n={},s=new Float32Array(8),r=new WeakMap,a=new pt,o=[];for(let c=0;c<8;c++)o[c]=[c,0];function l(c,u,h){const f=c.morphTargetInfluences;if(e.isWebGL2===!0){const m=u.morphAttributes.position||u.morphAttributes.normal||u.morphAttributes.color,_=m!==void 0?m.length:0;let g=r.get(u);if(g===void 0||g.count!==_){let P=function(){O.dispose(),r.delete(u),u.removeEventListener("dispose",P)};g!==void 0&&g.texture.dispose();const M=u.morphAttributes.position!==void 0,v=u.morphAttributes.normal!==void 0,E=u.morphAttributes.color!==void 0,T=u.morphAttributes.position||[],w=u.morphAttributes.normal||[],y=u.morphAttributes.color||[];let L=0;M===!0&&(L=1),v===!0&&(L=2),E===!0&&(L=3);let x=u.attributes.position.count*L,b=1;x>e.maxTextureSize&&(b=Math.ceil(x/e.maxTextureSize),x=e.maxTextureSize);const N=new Float32Array(x*b*4*_),O=new Ll(N,x,b,_);O.type=Un,O.needsUpdate=!0;const $=L*4;for(let U=0;U<_;U++){const B=T[U],k=w[U],X=y[U],V=x*b*4*U;for(let z=0;z<B.count;z++){const ne=z*$;M===!0&&(a.fromBufferAttribute(B,z),N[V+ne+0]=a.x,N[V+ne+1]=a.y,N[V+ne+2]=a.z,N[V+ne+3]=0),v===!0&&(a.fromBufferAttribute(k,z),N[V+ne+4]=a.x,N[V+ne+5]=a.y,N[V+ne+6]=a.z,N[V+ne+7]=0),E===!0&&(a.fromBufferAttribute(X,z),N[V+ne+8]=a.x,N[V+ne+9]=a.y,N[V+ne+10]=a.z,N[V+ne+11]=X.itemSize===4?a.w:1)}}g={count:_,texture:O,size:new qe(x,b)},r.set(u,g),u.addEventListener("dispose",P)}let p=0;for(let M=0;M<f.length;M++)p+=f[M];const d=u.morphTargetsRelative?1:1-p;h.getUniforms().setValue(i,"morphTargetBaseInfluence",d),h.getUniforms().setValue(i,"morphTargetInfluences",f),h.getUniforms().setValue(i,"morphTargetsTexture",g.texture,t),h.getUniforms().setValue(i,"morphTargetsTextureSize",g.size)}else{const m=f===void 0?0:f.length;let _=n[u.id];if(_===void 0||_.length!==m){_=[];for(let v=0;v<m;v++)_[v]=[v,0];n[u.id]=_}for(let v=0;v<m;v++){const E=_[v];E[0]=v,E[1]=f[v]}_.sort(Ad);for(let v=0;v<8;v++)v<m&&_[v][1]?(o[v][0]=_[v][0],o[v][1]=_[v][1]):(o[v][0]=Number.MAX_SAFE_INTEGER,o[v][1]=0);o.sort(Td);const g=u.morphAttributes.position,p=u.morphAttributes.normal;let d=0;for(let v=0;v<8;v++){const E=o[v],T=E[0],w=E[1];T!==Number.MAX_SAFE_INTEGER&&w?(g&&u.getAttribute("morphTarget"+v)!==g[T]&&u.setAttribute("morphTarget"+v,g[T]),p&&u.getAttribute("morphNormal"+v)!==p[T]&&u.setAttribute("morphNormal"+v,p[T]),s[v]=w,d+=w):(g&&u.hasAttribute("morphTarget"+v)===!0&&u.deleteAttribute("morphTarget"+v),p&&u.hasAttribute("morphNormal"+v)===!0&&u.deleteAttribute("morphNormal"+v),s[v]=0)}const M=u.morphTargetsRelative?1:1-d;h.getUniforms().setValue(i,"morphTargetBaseInfluence",M),h.getUniforms().setValue(i,"morphTargetInfluences",s)}}return{update:l}}function Rd(i,e,t,n){let s=new WeakMap;function r(l){const c=n.render.frame,u=l.geometry,h=e.get(l,u);if(s.get(h)!==c&&(e.update(h),s.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const f=l.skeleton;s.get(f)!==c&&(f.update(),s.set(f,c))}return h}function a(){s=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:a}}class Gl extends Xt{constructor(e,t,n,s,r,a,o,l,c,u){if(u=u!==void 0?u:$n,u!==$n&&u!==Ii)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&u===$n&&(n=In),n===void 0&&u===Ii&&(n=Qn),super(null,s,r,a,o,l,u,n,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=o!==void 0?o:Ft,this.minFilter=l!==void 0?l:Ft,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}const Vl=new Xt,Wl=new Gl(1,1);Wl.compareFunction=wl;const Xl=new Ll,ql=new hu,Yl=new zl,Mo=[],So=[],Eo=new Float32Array(16),yo=new Float32Array(9),bo=new Float32Array(4);function Oi(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=Mo[s];if(r===void 0&&(r=new Float32Array(s),Mo[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function yt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function bt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Ks(i,e){let t=So[e];t===void 0&&(t=new Int32Array(e),So[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Cd(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function Pd(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(yt(t,e))return;i.uniform2fv(this.addr,e),bt(t,e)}}function Ld(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(yt(t,e))return;i.uniform3fv(this.addr,e),bt(t,e)}}function Dd(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(yt(t,e))return;i.uniform4fv(this.addr,e),bt(t,e)}}function Id(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(yt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),bt(t,e)}else{if(yt(t,n))return;bo.set(n),i.uniformMatrix2fv(this.addr,!1,bo),bt(t,n)}}function Ud(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(yt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),bt(t,e)}else{if(yt(t,n))return;yo.set(n),i.uniformMatrix3fv(this.addr,!1,yo),bt(t,n)}}function Nd(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(yt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),bt(t,e)}else{if(yt(t,n))return;Eo.set(n),i.uniformMatrix4fv(this.addr,!1,Eo),bt(t,n)}}function Fd(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Od(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(yt(t,e))return;i.uniform2iv(this.addr,e),bt(t,e)}}function Bd(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(yt(t,e))return;i.uniform3iv(this.addr,e),bt(t,e)}}function zd(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(yt(t,e))return;i.uniform4iv(this.addr,e),bt(t,e)}}function Hd(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function kd(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(yt(t,e))return;i.uniform2uiv(this.addr,e),bt(t,e)}}function Gd(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(yt(t,e))return;i.uniform3uiv(this.addr,e),bt(t,e)}}function Vd(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(yt(t,e))return;i.uniform4uiv(this.addr,e),bt(t,e)}}function Wd(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);const r=this.type===i.SAMPLER_2D_SHADOW?Wl:Vl;t.setTexture2D(e||r,s)}function Xd(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||ql,s)}function qd(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||Yl,s)}function Yd(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||Xl,s)}function jd(i){switch(i){case 5126:return Cd;case 35664:return Pd;case 35665:return Ld;case 35666:return Dd;case 35674:return Id;case 35675:return Ud;case 35676:return Nd;case 5124:case 35670:return Fd;case 35667:case 35671:return Od;case 35668:case 35672:return Bd;case 35669:case 35673:return zd;case 5125:return Hd;case 36294:return kd;case 36295:return Gd;case 36296:return Vd;case 35678:case 36198:case 36298:case 36306:case 35682:return Wd;case 35679:case 36299:case 36307:return Xd;case 35680:case 36300:case 36308:case 36293:return qd;case 36289:case 36303:case 36311:case 36292:return Yd}}function Kd(i,e){i.uniform1fv(this.addr,e)}function Zd(i,e){const t=Oi(e,this.size,2);i.uniform2fv(this.addr,t)}function Jd(i,e){const t=Oi(e,this.size,3);i.uniform3fv(this.addr,t)}function Qd(i,e){const t=Oi(e,this.size,4);i.uniform4fv(this.addr,t)}function $d(i,e){const t=Oi(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function ep(i,e){const t=Oi(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function tp(i,e){const t=Oi(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function np(i,e){i.uniform1iv(this.addr,e)}function ip(i,e){i.uniform2iv(this.addr,e)}function sp(i,e){i.uniform3iv(this.addr,e)}function rp(i,e){i.uniform4iv(this.addr,e)}function ap(i,e){i.uniform1uiv(this.addr,e)}function op(i,e){i.uniform2uiv(this.addr,e)}function lp(i,e){i.uniform3uiv(this.addr,e)}function cp(i,e){i.uniform4uiv(this.addr,e)}function up(i,e,t){const n=this.cache,s=e.length,r=Ks(t,s);yt(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));for(let a=0;a!==s;++a)t.setTexture2D(e[a]||Vl,r[a])}function hp(i,e,t){const n=this.cache,s=e.length,r=Ks(t,s);yt(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||ql,r[a])}function fp(i,e,t){const n=this.cache,s=e.length,r=Ks(t,s);yt(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||Yl,r[a])}function dp(i,e,t){const n=this.cache,s=e.length,r=Ks(t,s);yt(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Xl,r[a])}function pp(i){switch(i){case 5126:return Kd;case 35664:return Zd;case 35665:return Jd;case 35666:return Qd;case 35674:return $d;case 35675:return ep;case 35676:return tp;case 5124:case 35670:return np;case 35667:case 35671:return ip;case 35668:case 35672:return sp;case 35669:case 35673:return rp;case 5125:return ap;case 36294:return op;case 36295:return lp;case 36296:return cp;case 35678:case 36198:case 36298:case 36306:case 35682:return up;case 35679:case 36299:case 36307:return hp;case 35680:case 36300:case 36308:case 36293:return fp;case 36289:case 36303:case 36311:case 36292:return dp}}class mp{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=jd(t.type)}}class _p{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=pp(t.type)}}class gp{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const Rr=/(\w+)(\])?(\[|\.)?/g;function To(i,e){i.seq.push(e),i.map[e.id]=e}function vp(i,e,t){const n=i.name,s=n.length;for(Rr.lastIndex=0;;){const r=Rr.exec(n),a=Rr.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){To(t,c===void 0?new mp(o,i,e):new _p(o,i,e));break}else{let h=t.map[o];h===void 0&&(h=new gp(o),To(t,h)),t=h}}}class Ls{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=e.getActiveUniform(t,s),a=e.getUniformLocation(t,r.name);vp(r,a,this)}}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function Ao(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const xp=37297;let Mp=0;function Sp(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}function Ep(i){const e=ut.getPrimaries(ut.workingColorSpace),t=ut.getPrimaries(i);let n;switch(e===t?n="":e===Os&&t===Fs?n="LinearDisplayP3ToLinearSRGB":e===Fs&&t===Os&&(n="LinearSRGBToLinearDisplayP3"),i){case Sn:case qs:return[n,"LinearTransferOETF"];case wt:case ia:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",i),[n,"LinearTransferOETF"]}}function wo(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),s=i.getShaderInfoLog(e).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const a=parseInt(r[1]);return t.toUpperCase()+`

`+s+`

`+Sp(i.getShaderSource(e),a)}else return s}function yp(i,e){const t=Ep(e);return`vec4 ${i}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function bp(i,e){let t;switch(e){case Uc:t="Linear";break;case Nc:t="Reinhard";break;case Fc:t="OptimizedCineon";break;case _l:t="ACESFilmic";break;case Bc:t="AgX";break;case Oc:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function Tp(i){return[i.extensionDerivatives||i.envMapCubeUVHeight||i.bumpMap||i.normalMapTangentSpace||i.clearcoatNormalMap||i.flatShading||i.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(i.extensionFragDepth||i.logarithmicDepthBuffer)&&i.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",i.extensionDrawBuffers&&i.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(i.extensionShaderTextureLOD||i.envMap||i.transmission)&&i.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(wi).join(`
`)}function Ap(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(wi).join(`
`)}function wp(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Rp(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function wi(i){return i!==""}function Ro(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Co(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Cp=/^[ \t]*#include +<([\w\d./]+)>/gm;function Zr(i){return i.replace(Cp,Lp)}const Pp=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function Lp(i,e){let t=Qe[e];if(t===void 0){const n=Pp.get(e);if(n!==void 0)t=Qe[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Zr(t)}const Dp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Po(i){return i.replace(Dp,Ip)}function Ip(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Lo(i){let e="precision "+i.precision+` float;
precision `+i.precision+" int;";return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function Up(i){let e="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===pl?e="SHADOWMAP_TYPE_PCF":i.shadowMapType===lc?e="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===vn&&(e="SHADOWMAP_TYPE_VSM"),e}function Np(i){let e="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Li:case Di:e="ENVMAP_TYPE_CUBE";break;case Xs:e="ENVMAP_TYPE_CUBE_UV";break}return e}function Fp(i){let e="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case Di:e="ENVMAP_MODE_REFRACTION";break}return e}function Op(i){let e="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case ml:e="ENVMAP_BLENDING_MULTIPLY";break;case Dc:e="ENVMAP_BLENDING_MIX";break;case Ic:e="ENVMAP_BLENDING_ADD";break}return e}function Bp(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:n,maxMip:t}}function zp(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=Up(t),c=Np(t),u=Fp(t),h=Op(t),f=Bp(t),m=t.isWebGL2?"":Tp(t),_=Ap(t),g=wp(r),p=s.createProgram();let d,M,v=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(d=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(wi).join(`
`),d.length>0&&(d+=`
`),M=[m,"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(wi).join(`
`),M.length>0&&(M+=`
`)):(d=[Lo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors&&t.isWebGL2?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(wi).join(`
`),M=[m,Lo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Fn?"#define TONE_MAPPING":"",t.toneMapping!==Fn?Qe.tonemapping_pars_fragment:"",t.toneMapping!==Fn?bp("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Qe.colorspace_pars_fragment,yp("linearToOutputTexel",t.outputColorSpace),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(wi).join(`
`)),a=Zr(a),a=Ro(a,t),a=Co(a,t),o=Zr(o),o=Ro(o,t),o=Co(o,t),a=Po(a),o=Po(o),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,d=[_,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+d,M=["precision mediump sampler2DArray;","#define varying in",t.glslVersion===ja?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ja?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+M);const E=v+d+a,T=v+M+o,w=Ao(s,s.VERTEX_SHADER,E),y=Ao(s,s.FRAGMENT_SHADER,T);s.attachShader(p,w),s.attachShader(p,y),t.index0AttributeName!==void 0?s.bindAttribLocation(p,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(p,0,"position"),s.linkProgram(p);function L(O){if(i.debug.checkShaderErrors){const $=s.getProgramInfoLog(p).trim(),P=s.getShaderInfoLog(w).trim(),U=s.getShaderInfoLog(y).trim();let B=!0,k=!0;if(s.getProgramParameter(p,s.LINK_STATUS)===!1)if(B=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,p,w,y);else{const X=wo(s,w,"vertex"),V=wo(s,y,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(p,s.VALIDATE_STATUS)+`

Program Info Log: `+$+`
`+X+`
`+V)}else $!==""?console.warn("THREE.WebGLProgram: Program Info Log:",$):(P===""||U==="")&&(k=!1);k&&(O.diagnostics={runnable:B,programLog:$,vertexShader:{log:P,prefix:d},fragmentShader:{log:U,prefix:M}})}s.deleteShader(w),s.deleteShader(y),x=new Ls(s,p),b=Rp(s,p)}let x;this.getUniforms=function(){return x===void 0&&L(this),x};let b;this.getAttributes=function(){return b===void 0&&L(this),b};let N=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return N===!1&&(N=s.getProgramParameter(p,xp)),N},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(p),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Mp++,this.cacheKey=e,this.usedTimes=1,this.program=p,this.vertexShader=w,this.fragmentShader=y,this}let Hp=0;class kp{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new Gp(e),t.set(e,n)),n}}class Gp{constructor(e){this.id=Hp++,this.code=e,this.usedTimes=0}}function Vp(i,e,t,n,s,r,a){const o=new Dl,l=new kp,c=[],u=s.isWebGL2,h=s.logarithmicDepthBuffer,f=s.vertexTextures;let m=s.precision;const _={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(x){return x===0?"uv":`uv${x}`}function p(x,b,N,O,$){const P=O.fog,U=$.geometry,B=x.isMeshStandardMaterial?O.environment:null,k=(x.isMeshStandardMaterial?t:e).get(x.envMap||B),X=k&&k.mapping===Xs?k.image.height:null,V=_[x.type];x.precision!==null&&(m=s.getMaxPrecision(x.precision),m!==x.precision&&console.warn("THREE.WebGLProgram.getParameters:",x.precision,"not supported, using",m,"instead."));const z=U.morphAttributes.position||U.morphAttributes.normal||U.morphAttributes.color,ne=z!==void 0?z.length:0;let _e=0;U.morphAttributes.position!==void 0&&(_e=1),U.morphAttributes.normal!==void 0&&(_e=2),U.morphAttributes.color!==void 0&&(_e=3);let Y,ee,pe,oe;if(V){const ft=ln[V];Y=ft.vertexShader,ee=ft.fragmentShader}else Y=x.vertexShader,ee=x.fragmentShader,l.update(x),pe=l.getVertexShaderID(x),oe=l.getFragmentShaderID(x);const ue=i.getRenderTarget(),Pe=$.isInstancedMesh===!0,Oe=$.isBatchedMesh===!0,Ue=!!x.map,He=!!x.matcap,W=!!k,lt=!!x.aoMap,we=!!x.lightMap,Re=!!x.bumpMap,De=!!x.normalMap,rt=!!x.displacementMap,Be=!!x.emissiveMap,A=!!x.metalnessMap,S=!!x.roughnessMap,q=x.anisotropy>0,ae=x.clearcoat>0,le=x.iridescence>0,ce=x.sheen>0,Te=x.transmission>0,xe=q&&!!x.anisotropyMap,ge=ae&&!!x.clearcoatMap,Ie=ae&&!!x.clearcoatNormalMap,Ge=ae&&!!x.clearcoatRoughnessMap,ie=le&&!!x.iridescenceMap,ke=le&&!!x.iridescenceThicknessMap,se=ce&&!!x.sheenColorMap,me=ce&&!!x.sheenRoughnessMap,Ae=!!x.specularMap,Se=!!x.specularColorMap,C=!!x.specularIntensityMap,he=Te&&!!x.transmissionMap,Ce=Te&&!!x.thicknessMap,be=!!x.gradientMap,re=!!x.alphaMap,I=x.alphaTest>0,de=!!x.alphaHash,ve=!!x.extensions,Fe=!!U.attributes.uv1,Ne=!!U.attributes.uv2,Ke=!!U.attributes.uv3;let Ve=Fn;return x.toneMapped&&(ue===null||ue.isXRRenderTarget===!0)&&(Ve=i.toneMapping),{isWebGL2:u,shaderID:V,shaderType:x.type,shaderName:x.name,vertexShader:Y,fragmentShader:ee,defines:x.defines,customVertexShaderID:pe,customFragmentShaderID:oe,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:m,batching:Oe,instancing:Pe,instancingColor:Pe&&$.instanceColor!==null,supportsVertexTextures:f,outputColorSpace:ue===null?i.outputColorSpace:ue.isXRRenderTarget===!0?ue.texture.colorSpace:Sn,map:Ue,matcap:He,envMap:W,envMapMode:W&&k.mapping,envMapCubeUVHeight:X,aoMap:lt,lightMap:we,bumpMap:Re,normalMap:De,displacementMap:f&&rt,emissiveMap:Be,normalMapObjectSpace:De&&x.normalMapType===Zc,normalMapTangentSpace:De&&x.normalMapType===Al,metalnessMap:A,roughnessMap:S,anisotropy:q,anisotropyMap:xe,clearcoat:ae,clearcoatMap:ge,clearcoatNormalMap:Ie,clearcoatRoughnessMap:Ge,iridescence:le,iridescenceMap:ie,iridescenceThicknessMap:ke,sheen:ce,sheenColorMap:se,sheenRoughnessMap:me,specularMap:Ae,specularColorMap:Se,specularIntensityMap:C,transmission:Te,transmissionMap:he,thicknessMap:Ce,gradientMap:be,opaque:x.transparent===!1&&x.blending===Ri,alphaMap:re,alphaTest:I,alphaHash:de,combine:x.combine,mapUv:Ue&&g(x.map.channel),aoMapUv:lt&&g(x.aoMap.channel),lightMapUv:we&&g(x.lightMap.channel),bumpMapUv:Re&&g(x.bumpMap.channel),normalMapUv:De&&g(x.normalMap.channel),displacementMapUv:rt&&g(x.displacementMap.channel),emissiveMapUv:Be&&g(x.emissiveMap.channel),metalnessMapUv:A&&g(x.metalnessMap.channel),roughnessMapUv:S&&g(x.roughnessMap.channel),anisotropyMapUv:xe&&g(x.anisotropyMap.channel),clearcoatMapUv:ge&&g(x.clearcoatMap.channel),clearcoatNormalMapUv:Ie&&g(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Ge&&g(x.clearcoatRoughnessMap.channel),iridescenceMapUv:ie&&g(x.iridescenceMap.channel),iridescenceThicknessMapUv:ke&&g(x.iridescenceThicknessMap.channel),sheenColorMapUv:se&&g(x.sheenColorMap.channel),sheenRoughnessMapUv:me&&g(x.sheenRoughnessMap.channel),specularMapUv:Ae&&g(x.specularMap.channel),specularColorMapUv:Se&&g(x.specularColorMap.channel),specularIntensityMapUv:C&&g(x.specularIntensityMap.channel),transmissionMapUv:he&&g(x.transmissionMap.channel),thicknessMapUv:Ce&&g(x.thicknessMap.channel),alphaMapUv:re&&g(x.alphaMap.channel),vertexTangents:!!U.attributes.tangent&&(De||q),vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!U.attributes.color&&U.attributes.color.itemSize===4,vertexUv1s:Fe,vertexUv2s:Ne,vertexUv3s:Ke,pointsUvs:$.isPoints===!0&&!!U.attributes.uv&&(Ue||re),fog:!!P,useFog:x.fog===!0,fogExp2:P&&P.isFogExp2,flatShading:x.flatShading===!0,sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:h,skinning:$.isSkinnedMesh===!0,morphTargets:U.morphAttributes.position!==void 0,morphNormals:U.morphAttributes.normal!==void 0,morphColors:U.morphAttributes.color!==void 0,morphTargetsCount:ne,morphTextureStride:_e,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:x.dithering,shadowMapEnabled:i.shadowMap.enabled&&N.length>0,shadowMapType:i.shadowMap.type,toneMapping:Ve,useLegacyLights:i._useLegacyLights,decodeVideoTexture:Ue&&x.map.isVideoTexture===!0&&ut.getTransfer(x.map.colorSpace)===ht,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===cn,flipSided:x.side===Ht,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionDerivatives:ve&&x.extensions.derivatives===!0,extensionFragDepth:ve&&x.extensions.fragDepth===!0,extensionDrawBuffers:ve&&x.extensions.drawBuffers===!0,extensionShaderTextureLOD:ve&&x.extensions.shaderTextureLOD===!0,extensionClipCullDistance:ve&&x.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:u||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:u||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:u||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()}}function d(x){const b=[];if(x.shaderID?b.push(x.shaderID):(b.push(x.customVertexShaderID),b.push(x.customFragmentShaderID)),x.defines!==void 0)for(const N in x.defines)b.push(N),b.push(x.defines[N]);return x.isRawShaderMaterial===!1&&(M(b,x),v(b,x),b.push(i.outputColorSpace)),b.push(x.customProgramCacheKey),b.join()}function M(x,b){x.push(b.precision),x.push(b.outputColorSpace),x.push(b.envMapMode),x.push(b.envMapCubeUVHeight),x.push(b.mapUv),x.push(b.alphaMapUv),x.push(b.lightMapUv),x.push(b.aoMapUv),x.push(b.bumpMapUv),x.push(b.normalMapUv),x.push(b.displacementMapUv),x.push(b.emissiveMapUv),x.push(b.metalnessMapUv),x.push(b.roughnessMapUv),x.push(b.anisotropyMapUv),x.push(b.clearcoatMapUv),x.push(b.clearcoatNormalMapUv),x.push(b.clearcoatRoughnessMapUv),x.push(b.iridescenceMapUv),x.push(b.iridescenceThicknessMapUv),x.push(b.sheenColorMapUv),x.push(b.sheenRoughnessMapUv),x.push(b.specularMapUv),x.push(b.specularColorMapUv),x.push(b.specularIntensityMapUv),x.push(b.transmissionMapUv),x.push(b.thicknessMapUv),x.push(b.combine),x.push(b.fogExp2),x.push(b.sizeAttenuation),x.push(b.morphTargetsCount),x.push(b.morphAttributeCount),x.push(b.numDirLights),x.push(b.numPointLights),x.push(b.numSpotLights),x.push(b.numSpotLightMaps),x.push(b.numHemiLights),x.push(b.numRectAreaLights),x.push(b.numDirLightShadows),x.push(b.numPointLightShadows),x.push(b.numSpotLightShadows),x.push(b.numSpotLightShadowsWithMaps),x.push(b.numLightProbes),x.push(b.shadowMapType),x.push(b.toneMapping),x.push(b.numClippingPlanes),x.push(b.numClipIntersection),x.push(b.depthPacking)}function v(x,b){o.disableAll(),b.isWebGL2&&o.enable(0),b.supportsVertexTextures&&o.enable(1),b.instancing&&o.enable(2),b.instancingColor&&o.enable(3),b.matcap&&o.enable(4),b.envMap&&o.enable(5),b.normalMapObjectSpace&&o.enable(6),b.normalMapTangentSpace&&o.enable(7),b.clearcoat&&o.enable(8),b.iridescence&&o.enable(9),b.alphaTest&&o.enable(10),b.vertexColors&&o.enable(11),b.vertexAlphas&&o.enable(12),b.vertexUv1s&&o.enable(13),b.vertexUv2s&&o.enable(14),b.vertexUv3s&&o.enable(15),b.vertexTangents&&o.enable(16),b.anisotropy&&o.enable(17),b.alphaHash&&o.enable(18),b.batching&&o.enable(19),x.push(o.mask),o.disableAll(),b.fog&&o.enable(0),b.useFog&&o.enable(1),b.flatShading&&o.enable(2),b.logarithmicDepthBuffer&&o.enable(3),b.skinning&&o.enable(4),b.morphTargets&&o.enable(5),b.morphNormals&&o.enable(6),b.morphColors&&o.enable(7),b.premultipliedAlpha&&o.enable(8),b.shadowMapEnabled&&o.enable(9),b.useLegacyLights&&o.enable(10),b.doubleSided&&o.enable(11),b.flipSided&&o.enable(12),b.useDepthPacking&&o.enable(13),b.dithering&&o.enable(14),b.transmission&&o.enable(15),b.sheen&&o.enable(16),b.opaque&&o.enable(17),b.pointsUvs&&o.enable(18),b.decodeVideoTexture&&o.enable(19),x.push(o.mask)}function E(x){const b=_[x.type];let N;if(b){const O=ln[b];N=bu.clone(O.uniforms)}else N=x.uniforms;return N}function T(x,b){let N;for(let O=0,$=c.length;O<$;O++){const P=c[O];if(P.cacheKey===b){N=P,++N.usedTimes;break}}return N===void 0&&(N=new zp(i,b,x,r),c.push(N)),N}function w(x){if(--x.usedTimes===0){const b=c.indexOf(x);c[b]=c[c.length-1],c.pop(),x.destroy()}}function y(x){l.remove(x)}function L(){l.dispose()}return{getParameters:p,getProgramCacheKey:d,getUniforms:E,acquireProgram:T,releaseProgram:w,releaseShaderCache:y,programs:c,dispose:L}}function Wp(){let i=new WeakMap;function e(r){let a=i.get(r);return a===void 0&&(a={},i.set(r,a)),a}function t(r){i.delete(r)}function n(r,a,o){i.get(r)[a]=o}function s(){i=new WeakMap}return{get:e,remove:t,update:n,dispose:s}}function Xp(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function Do(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Io(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(h,f,m,_,g,p){let d=i[e];return d===void 0?(d={id:h.id,object:h,geometry:f,material:m,groupOrder:_,renderOrder:h.renderOrder,z:g,group:p},i[e]=d):(d.id=h.id,d.object=h,d.geometry=f,d.material=m,d.groupOrder=_,d.renderOrder=h.renderOrder,d.z=g,d.group=p),e++,d}function o(h,f,m,_,g,p){const d=a(h,f,m,_,g,p);m.transmission>0?n.push(d):m.transparent===!0?s.push(d):t.push(d)}function l(h,f,m,_,g,p){const d=a(h,f,m,_,g,p);m.transmission>0?n.unshift(d):m.transparent===!0?s.unshift(d):t.unshift(d)}function c(h,f){t.length>1&&t.sort(h||Xp),n.length>1&&n.sort(f||Do),s.length>1&&s.sort(f||Do)}function u(){for(let h=e,f=i.length;h<f;h++){const m=i[h];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:u,sort:c}}function qp(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new Io,i.set(n,[a])):s>=r.length?(a=new Io,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function Yp(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new F,color:new it};break;case"SpotLight":t={position:new F,direction:new F,color:new it,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new F,color:new it,distance:0,decay:0};break;case"HemisphereLight":t={direction:new F,skyColor:new it,groundColor:new it};break;case"RectAreaLight":t={color:new it,position:new F,halfWidth:new F,halfHeight:new F};break}return i[e.id]=t,t}}}function jp(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new qe};break;case"SpotLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new qe};break;case"PointLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new qe,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let Kp=0;function Zp(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function Jp(i,e){const t=new Yp,n=jp(),s={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let u=0;u<9;u++)s.probe.push(new F);const r=new F,a=new Mt,o=new Mt;function l(u,h){let f=0,m=0,_=0;for(let O=0;O<9;O++)s.probe[O].set(0,0,0);let g=0,p=0,d=0,M=0,v=0,E=0,T=0,w=0,y=0,L=0,x=0;u.sort(Zp);const b=h===!0?Math.PI:1;for(let O=0,$=u.length;O<$;O++){const P=u[O],U=P.color,B=P.intensity,k=P.distance,X=P.shadow&&P.shadow.map?P.shadow.map.texture:null;if(P.isAmbientLight)f+=U.r*B*b,m+=U.g*B*b,_+=U.b*B*b;else if(P.isLightProbe){for(let V=0;V<9;V++)s.probe[V].addScaledVector(P.sh.coefficients[V],B);x++}else if(P.isDirectionalLight){const V=t.get(P);if(V.color.copy(P.color).multiplyScalar(P.intensity*b),P.castShadow){const z=P.shadow,ne=n.get(P);ne.shadowBias=z.bias,ne.shadowNormalBias=z.normalBias,ne.shadowRadius=z.radius,ne.shadowMapSize=z.mapSize,s.directionalShadow[g]=ne,s.directionalShadowMap[g]=X,s.directionalShadowMatrix[g]=P.shadow.matrix,E++}s.directional[g]=V,g++}else if(P.isSpotLight){const V=t.get(P);V.position.setFromMatrixPosition(P.matrixWorld),V.color.copy(U).multiplyScalar(B*b),V.distance=k,V.coneCos=Math.cos(P.angle),V.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),V.decay=P.decay,s.spot[d]=V;const z=P.shadow;if(P.map&&(s.spotLightMap[y]=P.map,y++,z.updateMatrices(P),P.castShadow&&L++),s.spotLightMatrix[d]=z.matrix,P.castShadow){const ne=n.get(P);ne.shadowBias=z.bias,ne.shadowNormalBias=z.normalBias,ne.shadowRadius=z.radius,ne.shadowMapSize=z.mapSize,s.spotShadow[d]=ne,s.spotShadowMap[d]=X,w++}d++}else if(P.isRectAreaLight){const V=t.get(P);V.color.copy(U).multiplyScalar(B),V.halfWidth.set(P.width*.5,0,0),V.halfHeight.set(0,P.height*.5,0),s.rectArea[M]=V,M++}else if(P.isPointLight){const V=t.get(P);if(V.color.copy(P.color).multiplyScalar(P.intensity*b),V.distance=P.distance,V.decay=P.decay,P.castShadow){const z=P.shadow,ne=n.get(P);ne.shadowBias=z.bias,ne.shadowNormalBias=z.normalBias,ne.shadowRadius=z.radius,ne.shadowMapSize=z.mapSize,ne.shadowCameraNear=z.camera.near,ne.shadowCameraFar=z.camera.far,s.pointShadow[p]=ne,s.pointShadowMap[p]=X,s.pointShadowMatrix[p]=P.shadow.matrix,T++}s.point[p]=V,p++}else if(P.isHemisphereLight){const V=t.get(P);V.skyColor.copy(P.color).multiplyScalar(B*b),V.groundColor.copy(P.groundColor).multiplyScalar(B*b),s.hemi[v]=V,v++}}M>0&&(e.isWebGL2?i.has("OES_texture_float_linear")===!0?(s.rectAreaLTC1=Me.LTC_FLOAT_1,s.rectAreaLTC2=Me.LTC_FLOAT_2):(s.rectAreaLTC1=Me.LTC_HALF_1,s.rectAreaLTC2=Me.LTC_HALF_2):i.has("OES_texture_float_linear")===!0?(s.rectAreaLTC1=Me.LTC_FLOAT_1,s.rectAreaLTC2=Me.LTC_FLOAT_2):i.has("OES_texture_half_float_linear")===!0?(s.rectAreaLTC1=Me.LTC_HALF_1,s.rectAreaLTC2=Me.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),s.ambient[0]=f,s.ambient[1]=m,s.ambient[2]=_;const N=s.hash;(N.directionalLength!==g||N.pointLength!==p||N.spotLength!==d||N.rectAreaLength!==M||N.hemiLength!==v||N.numDirectionalShadows!==E||N.numPointShadows!==T||N.numSpotShadows!==w||N.numSpotMaps!==y||N.numLightProbes!==x)&&(s.directional.length=g,s.spot.length=d,s.rectArea.length=M,s.point.length=p,s.hemi.length=v,s.directionalShadow.length=E,s.directionalShadowMap.length=E,s.pointShadow.length=T,s.pointShadowMap.length=T,s.spotShadow.length=w,s.spotShadowMap.length=w,s.directionalShadowMatrix.length=E,s.pointShadowMatrix.length=T,s.spotLightMatrix.length=w+y-L,s.spotLightMap.length=y,s.numSpotLightShadowsWithMaps=L,s.numLightProbes=x,N.directionalLength=g,N.pointLength=p,N.spotLength=d,N.rectAreaLength=M,N.hemiLength=v,N.numDirectionalShadows=E,N.numPointShadows=T,N.numSpotShadows=w,N.numSpotMaps=y,N.numLightProbes=x,s.version=Kp++)}function c(u,h){let f=0,m=0,_=0,g=0,p=0;const d=h.matrixWorldInverse;for(let M=0,v=u.length;M<v;M++){const E=u[M];if(E.isDirectionalLight){const T=s.directional[f];T.direction.setFromMatrixPosition(E.matrixWorld),r.setFromMatrixPosition(E.target.matrixWorld),T.direction.sub(r),T.direction.transformDirection(d),f++}else if(E.isSpotLight){const T=s.spot[_];T.position.setFromMatrixPosition(E.matrixWorld),T.position.applyMatrix4(d),T.direction.setFromMatrixPosition(E.matrixWorld),r.setFromMatrixPosition(E.target.matrixWorld),T.direction.sub(r),T.direction.transformDirection(d),_++}else if(E.isRectAreaLight){const T=s.rectArea[g];T.position.setFromMatrixPosition(E.matrixWorld),T.position.applyMatrix4(d),o.identity(),a.copy(E.matrixWorld),a.premultiply(d),o.extractRotation(a),T.halfWidth.set(E.width*.5,0,0),T.halfHeight.set(0,E.height*.5,0),T.halfWidth.applyMatrix4(o),T.halfHeight.applyMatrix4(o),g++}else if(E.isPointLight){const T=s.point[m];T.position.setFromMatrixPosition(E.matrixWorld),T.position.applyMatrix4(d),m++}else if(E.isHemisphereLight){const T=s.hemi[p];T.direction.setFromMatrixPosition(E.matrixWorld),T.direction.transformDirection(d),p++}}}return{setup:l,setupView:c,state:s}}function Uo(i,e){const t=new Jp(i,e),n=[],s=[];function r(){n.length=0,s.length=0}function a(h){n.push(h)}function o(h){s.push(h)}function l(h){t.setup(n,h)}function c(h){t.setupView(n,h)}return{init:r,state:{lightsArray:n,shadowsArray:s,lights:t},setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function Qp(i,e){let t=new WeakMap;function n(r,a=0){const o=t.get(r);let l;return o===void 0?(l=new Uo(i,e),t.set(r,[l])):a>=o.length?(l=new Uo(i,e),o.push(l)):l=o[a],l}function s(){t=new WeakMap}return{get:n,dispose:s}}class $p extends Fi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=jc,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class em extends Fi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const tm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,nm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function im(i,e,t){let n=new ra;const s=new qe,r=new qe,a=new pt,o=new $p({depthPacking:Kc}),l=new em,c={},u=t.maxTextureSize,h={[Bn]:Ht,[Ht]:Bn,[cn]:cn},f=new si({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new qe},radius:{value:4}},vertexShader:tm,fragmentShader:nm}),m=f.clone();m.defines.HORIZONTAL_PASS=1;const _=new sn;_.setAttribute("position",new hn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const g=new Jt(_,f),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=pl;let d=this.type;this.render=function(w,y,L){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||w.length===0)return;const x=i.getRenderTarget(),b=i.getActiveCubeFace(),N=i.getActiveMipmapLevel(),O=i.state;O.setBlending(Nn),O.buffers.color.setClear(1,1,1,1),O.buffers.depth.setTest(!0),O.setScissorTest(!1);const $=d!==vn&&this.type===vn,P=d===vn&&this.type!==vn;for(let U=0,B=w.length;U<B;U++){const k=w[U],X=k.shadow;if(X===void 0){console.warn("THREE.WebGLShadowMap:",k,"has no shadow.");continue}if(X.autoUpdate===!1&&X.needsUpdate===!1)continue;s.copy(X.mapSize);const V=X.getFrameExtents();if(s.multiply(V),r.copy(X.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/V.x),s.x=r.x*V.x,X.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/V.y),s.y=r.y*V.y,X.mapSize.y=r.y)),X.map===null||$===!0||P===!0){const ne=this.type!==vn?{minFilter:Ft,magFilter:Ft}:{};X.map!==null&&X.map.dispose(),X.map=new ti(s.x,s.y,ne),X.map.texture.name=k.name+".shadowMap",X.camera.updateProjectionMatrix()}i.setRenderTarget(X.map),i.clear();const z=X.getViewportCount();for(let ne=0;ne<z;ne++){const _e=X.getViewport(ne);a.set(r.x*_e.x,r.y*_e.y,r.x*_e.z,r.y*_e.w),O.viewport(a),X.updateMatrices(k,ne),n=X.getFrustum(),E(y,L,X.camera,k,this.type)}X.isPointLightShadow!==!0&&this.type===vn&&M(X,L),X.needsUpdate=!1}d=this.type,p.needsUpdate=!1,i.setRenderTarget(x,b,N)};function M(w,y){const L=e.update(g);f.defines.VSM_SAMPLES!==w.blurSamples&&(f.defines.VSM_SAMPLES=w.blurSamples,m.defines.VSM_SAMPLES=w.blurSamples,f.needsUpdate=!0,m.needsUpdate=!0),w.mapPass===null&&(w.mapPass=new ti(s.x,s.y)),f.uniforms.shadow_pass.value=w.map.texture,f.uniforms.resolution.value=w.mapSize,f.uniforms.radius.value=w.radius,i.setRenderTarget(w.mapPass),i.clear(),i.renderBufferDirect(y,null,L,f,g,null),m.uniforms.shadow_pass.value=w.mapPass.texture,m.uniforms.resolution.value=w.mapSize,m.uniforms.radius.value=w.radius,i.setRenderTarget(w.map),i.clear(),i.renderBufferDirect(y,null,L,m,g,null)}function v(w,y,L,x){let b=null;const N=L.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(N!==void 0)b=N;else if(b=L.isPointLight===!0?l:o,i.localClippingEnabled&&y.clipShadows===!0&&Array.isArray(y.clippingPlanes)&&y.clippingPlanes.length!==0||y.displacementMap&&y.displacementScale!==0||y.alphaMap&&y.alphaTest>0||y.map&&y.alphaTest>0){const O=b.uuid,$=y.uuid;let P=c[O];P===void 0&&(P={},c[O]=P);let U=P[$];U===void 0&&(U=b.clone(),P[$]=U,y.addEventListener("dispose",T)),b=U}if(b.visible=y.visible,b.wireframe=y.wireframe,x===vn?b.side=y.shadowSide!==null?y.shadowSide:y.side:b.side=y.shadowSide!==null?y.shadowSide:h[y.side],b.alphaMap=y.alphaMap,b.alphaTest=y.alphaTest,b.map=y.map,b.clipShadows=y.clipShadows,b.clippingPlanes=y.clippingPlanes,b.clipIntersection=y.clipIntersection,b.displacementMap=y.displacementMap,b.displacementScale=y.displacementScale,b.displacementBias=y.displacementBias,b.wireframeLinewidth=y.wireframeLinewidth,b.linewidth=y.linewidth,L.isPointLight===!0&&b.isMeshDistanceMaterial===!0){const O=i.properties.get(b);O.light=L}return b}function E(w,y,L,x,b){if(w.visible===!1)return;if(w.layers.test(y.layers)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&b===vn)&&(!w.frustumCulled||n.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,w.matrixWorld);const $=e.update(w),P=w.material;if(Array.isArray(P)){const U=$.groups;for(let B=0,k=U.length;B<k;B++){const X=U[B],V=P[X.materialIndex];if(V&&V.visible){const z=v(w,V,x,b);w.onBeforeShadow(i,w,y,L,$,z,X),i.renderBufferDirect(L,null,$,z,w,X),w.onAfterShadow(i,w,y,L,$,z,X)}}}else if(P.visible){const U=v(w,P,x,b);w.onBeforeShadow(i,w,y,L,$,U,null),i.renderBufferDirect(L,null,$,U,w,null),w.onAfterShadow(i,w,y,L,$,U,null)}}const O=w.children;for(let $=0,P=O.length;$<P;$++)E(O[$],y,L,x,b)}function T(w){w.target.removeEventListener("dispose",T);for(const L in c){const x=c[L],b=w.target.uuid;b in x&&(x[b].dispose(),delete x[b])}}}function sm(i,e,t){const n=t.isWebGL2;function s(){let I=!1;const de=new pt;let ve=null;const Fe=new pt(0,0,0,0);return{setMask:function(Ne){ve!==Ne&&!I&&(i.colorMask(Ne,Ne,Ne,Ne),ve=Ne)},setLocked:function(Ne){I=Ne},setClear:function(Ne,Ke,Ve,ot,ft){ft===!0&&(Ne*=ot,Ke*=ot,Ve*=ot),de.set(Ne,Ke,Ve,ot),Fe.equals(de)===!1&&(i.clearColor(Ne,Ke,Ve,ot),Fe.copy(de))},reset:function(){I=!1,ve=null,Fe.set(-1,0,0,0)}}}function r(){let I=!1,de=null,ve=null,Fe=null;return{setTest:function(Ne){Ne?Oe(i.DEPTH_TEST):Ue(i.DEPTH_TEST)},setMask:function(Ne){de!==Ne&&!I&&(i.depthMask(Ne),de=Ne)},setFunc:function(Ne){if(ve!==Ne){switch(Ne){case Tc:i.depthFunc(i.NEVER);break;case Ac:i.depthFunc(i.ALWAYS);break;case wc:i.depthFunc(i.LESS);break;case Us:i.depthFunc(i.LEQUAL);break;case Rc:i.depthFunc(i.EQUAL);break;case Cc:i.depthFunc(i.GEQUAL);break;case Pc:i.depthFunc(i.GREATER);break;case Lc:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}ve=Ne}},setLocked:function(Ne){I=Ne},setClear:function(Ne){Fe!==Ne&&(i.clearDepth(Ne),Fe=Ne)},reset:function(){I=!1,de=null,ve=null,Fe=null}}}function a(){let I=!1,de=null,ve=null,Fe=null,Ne=null,Ke=null,Ve=null,ot=null,ft=null;return{setTest:function(st){I||(st?Oe(i.STENCIL_TEST):Ue(i.STENCIL_TEST))},setMask:function(st){de!==st&&!I&&(i.stencilMask(st),de=st)},setFunc:function(st,mt,Ut){(ve!==st||Fe!==mt||Ne!==Ut)&&(i.stencilFunc(st,mt,Ut),ve=st,Fe=mt,Ne=Ut)},setOp:function(st,mt,Ut){(Ke!==st||Ve!==mt||ot!==Ut)&&(i.stencilOp(st,mt,Ut),Ke=st,Ve=mt,ot=Ut)},setLocked:function(st){I=st},setClear:function(st){ft!==st&&(i.clearStencil(st),ft=st)},reset:function(){I=!1,de=null,ve=null,Fe=null,Ne=null,Ke=null,Ve=null,ot=null,ft=null}}}const o=new s,l=new r,c=new a,u=new WeakMap,h=new WeakMap;let f={},m={},_=new WeakMap,g=[],p=null,d=!1,M=null,v=null,E=null,T=null,w=null,y=null,L=null,x=new it(0,0,0),b=0,N=!1,O=null,$=null,P=null,U=null,B=null;const k=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let X=!1,V=0;const z=i.getParameter(i.VERSION);z.indexOf("WebGL")!==-1?(V=parseFloat(/^WebGL (\d)/.exec(z)[1]),X=V>=1):z.indexOf("OpenGL ES")!==-1&&(V=parseFloat(/^OpenGL ES (\d)/.exec(z)[1]),X=V>=2);let ne=null,_e={};const Y=i.getParameter(i.SCISSOR_BOX),ee=i.getParameter(i.VIEWPORT),pe=new pt().fromArray(Y),oe=new pt().fromArray(ee);function ue(I,de,ve,Fe){const Ne=new Uint8Array(4),Ke=i.createTexture();i.bindTexture(I,Ke),i.texParameteri(I,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(I,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ve=0;Ve<ve;Ve++)n&&(I===i.TEXTURE_3D||I===i.TEXTURE_2D_ARRAY)?i.texImage3D(de,0,i.RGBA,1,1,Fe,0,i.RGBA,i.UNSIGNED_BYTE,Ne):i.texImage2D(de+Ve,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Ne);return Ke}const Pe={};Pe[i.TEXTURE_2D]=ue(i.TEXTURE_2D,i.TEXTURE_2D,1),Pe[i.TEXTURE_CUBE_MAP]=ue(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(Pe[i.TEXTURE_2D_ARRAY]=ue(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Pe[i.TEXTURE_3D]=ue(i.TEXTURE_3D,i.TEXTURE_3D,1,1)),o.setClear(0,0,0,1),l.setClear(1),c.setClear(0),Oe(i.DEPTH_TEST),l.setFunc(Us),Be(!1),A(pa),Oe(i.CULL_FACE),De(Nn);function Oe(I){f[I]!==!0&&(i.enable(I),f[I]=!0)}function Ue(I){f[I]!==!1&&(i.disable(I),f[I]=!1)}function He(I,de){return m[I]!==de?(i.bindFramebuffer(I,de),m[I]=de,n&&(I===i.DRAW_FRAMEBUFFER&&(m[i.FRAMEBUFFER]=de),I===i.FRAMEBUFFER&&(m[i.DRAW_FRAMEBUFFER]=de)),!0):!1}function W(I,de){let ve=g,Fe=!1;if(I)if(ve=_.get(de),ve===void 0&&(ve=[],_.set(de,ve)),I.isWebGLMultipleRenderTargets){const Ne=I.texture;if(ve.length!==Ne.length||ve[0]!==i.COLOR_ATTACHMENT0){for(let Ke=0,Ve=Ne.length;Ke<Ve;Ke++)ve[Ke]=i.COLOR_ATTACHMENT0+Ke;ve.length=Ne.length,Fe=!0}}else ve[0]!==i.COLOR_ATTACHMENT0&&(ve[0]=i.COLOR_ATTACHMENT0,Fe=!0);else ve[0]!==i.BACK&&(ve[0]=i.BACK,Fe=!0);Fe&&(t.isWebGL2?i.drawBuffers(ve):e.get("WEBGL_draw_buffers").drawBuffersWEBGL(ve))}function lt(I){return p!==I?(i.useProgram(I),p=I,!0):!1}const we={[Kn]:i.FUNC_ADD,[uc]:i.FUNC_SUBTRACT,[hc]:i.FUNC_REVERSE_SUBTRACT};if(n)we[va]=i.MIN,we[xa]=i.MAX;else{const I=e.get("EXT_blend_minmax");I!==null&&(we[va]=I.MIN_EXT,we[xa]=I.MAX_EXT)}const Re={[fc]:i.ZERO,[dc]:i.ONE,[pc]:i.SRC_COLOR,[kr]:i.SRC_ALPHA,[Mc]:i.SRC_ALPHA_SATURATE,[vc]:i.DST_COLOR,[_c]:i.DST_ALPHA,[mc]:i.ONE_MINUS_SRC_COLOR,[Gr]:i.ONE_MINUS_SRC_ALPHA,[xc]:i.ONE_MINUS_DST_COLOR,[gc]:i.ONE_MINUS_DST_ALPHA,[Sc]:i.CONSTANT_COLOR,[Ec]:i.ONE_MINUS_CONSTANT_COLOR,[yc]:i.CONSTANT_ALPHA,[bc]:i.ONE_MINUS_CONSTANT_ALPHA};function De(I,de,ve,Fe,Ne,Ke,Ve,ot,ft,st){if(I===Nn){d===!0&&(Ue(i.BLEND),d=!1);return}if(d===!1&&(Oe(i.BLEND),d=!0),I!==cc){if(I!==M||st!==N){if((v!==Kn||w!==Kn)&&(i.blendEquation(i.FUNC_ADD),v=Kn,w=Kn),st)switch(I){case Ri:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ma:i.blendFunc(i.ONE,i.ONE);break;case _a:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ga:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}else switch(I){case Ri:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ma:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case _a:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ga:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}E=null,T=null,y=null,L=null,x.set(0,0,0),b=0,M=I,N=st}return}Ne=Ne||de,Ke=Ke||ve,Ve=Ve||Fe,(de!==v||Ne!==w)&&(i.blendEquationSeparate(we[de],we[Ne]),v=de,w=Ne),(ve!==E||Fe!==T||Ke!==y||Ve!==L)&&(i.blendFuncSeparate(Re[ve],Re[Fe],Re[Ke],Re[Ve]),E=ve,T=Fe,y=Ke,L=Ve),(ot.equals(x)===!1||ft!==b)&&(i.blendColor(ot.r,ot.g,ot.b,ft),x.copy(ot),b=ft),M=I,N=!1}function rt(I,de){I.side===cn?Ue(i.CULL_FACE):Oe(i.CULL_FACE);let ve=I.side===Ht;de&&(ve=!ve),Be(ve),I.blending===Ri&&I.transparent===!1?De(Nn):De(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),l.setFunc(I.depthFunc),l.setTest(I.depthTest),l.setMask(I.depthWrite),o.setMask(I.colorWrite);const Fe=I.stencilWrite;c.setTest(Fe),Fe&&(c.setMask(I.stencilWriteMask),c.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),c.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),q(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?Oe(i.SAMPLE_ALPHA_TO_COVERAGE):Ue(i.SAMPLE_ALPHA_TO_COVERAGE)}function Be(I){O!==I&&(I?i.frontFace(i.CW):i.frontFace(i.CCW),O=I)}function A(I){I!==ac?(Oe(i.CULL_FACE),I!==$&&(I===pa?i.cullFace(i.BACK):I===oc?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Ue(i.CULL_FACE),$=I}function S(I){I!==P&&(X&&i.lineWidth(I),P=I)}function q(I,de,ve){I?(Oe(i.POLYGON_OFFSET_FILL),(U!==de||B!==ve)&&(i.polygonOffset(de,ve),U=de,B=ve)):Ue(i.POLYGON_OFFSET_FILL)}function ae(I){I?Oe(i.SCISSOR_TEST):Ue(i.SCISSOR_TEST)}function le(I){I===void 0&&(I=i.TEXTURE0+k-1),ne!==I&&(i.activeTexture(I),ne=I)}function ce(I,de,ve){ve===void 0&&(ne===null?ve=i.TEXTURE0+k-1:ve=ne);let Fe=_e[ve];Fe===void 0&&(Fe={type:void 0,texture:void 0},_e[ve]=Fe),(Fe.type!==I||Fe.texture!==de)&&(ne!==ve&&(i.activeTexture(ve),ne=ve),i.bindTexture(I,de||Pe[I]),Fe.type=I,Fe.texture=de)}function Te(){const I=_e[ne];I!==void 0&&I.type!==void 0&&(i.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function xe(){try{i.compressedTexImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ge(){try{i.compressedTexImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Ie(){try{i.texSubImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Ge(){try{i.texSubImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ie(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ke(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function se(){try{i.texStorage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function me(){try{i.texStorage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Ae(){try{i.texImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Se(){try{i.texImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function C(I){pe.equals(I)===!1&&(i.scissor(I.x,I.y,I.z,I.w),pe.copy(I))}function he(I){oe.equals(I)===!1&&(i.viewport(I.x,I.y,I.z,I.w),oe.copy(I))}function Ce(I,de){let ve=h.get(de);ve===void 0&&(ve=new WeakMap,h.set(de,ve));let Fe=ve.get(I);Fe===void 0&&(Fe=i.getUniformBlockIndex(de,I.name),ve.set(I,Fe))}function be(I,de){const Fe=h.get(de).get(I);u.get(de)!==Fe&&(i.uniformBlockBinding(de,Fe,I.__bindingPointIndex),u.set(de,Fe))}function re(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),n===!0&&(i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null)),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),f={},ne=null,_e={},m={},_=new WeakMap,g=[],p=null,d=!1,M=null,v=null,E=null,T=null,w=null,y=null,L=null,x=new it(0,0,0),b=0,N=!1,O=null,$=null,P=null,U=null,B=null,pe.set(0,0,i.canvas.width,i.canvas.height),oe.set(0,0,i.canvas.width,i.canvas.height),o.reset(),l.reset(),c.reset()}return{buffers:{color:o,depth:l,stencil:c},enable:Oe,disable:Ue,bindFramebuffer:He,drawBuffers:W,useProgram:lt,setBlending:De,setMaterial:rt,setFlipSided:Be,setCullFace:A,setLineWidth:S,setPolygonOffset:q,setScissorTest:ae,activeTexture:le,bindTexture:ce,unbindTexture:Te,compressedTexImage2D:xe,compressedTexImage3D:ge,texImage2D:Ae,texImage3D:Se,updateUBOMapping:Ce,uniformBlockBinding:be,texStorage2D:se,texStorage3D:me,texSubImage2D:Ie,texSubImage3D:Ge,compressedTexSubImage2D:ie,compressedTexSubImage3D:ke,scissor:C,viewport:he,reset:re}}function rm(i,e,t,n,s,r,a){const o=s.isWebGL2,l=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),u=new WeakMap;let h;const f=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(A,S){return m?new OffscreenCanvas(A,S):zs("canvas")}function g(A,S,q,ae){let le=1;if((A.width>ae||A.height>ae)&&(le=ae/Math.max(A.width,A.height)),le<1||S===!0)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap){const ce=S?Kr:Math.floor,Te=ce(le*A.width),xe=ce(le*A.height);h===void 0&&(h=_(Te,xe));const ge=q?_(Te,xe):h;return ge.width=Te,ge.height=xe,ge.getContext("2d").drawImage(A,0,0,Te,xe),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+A.width+"x"+A.height+") to ("+Te+"x"+xe+")."),ge}else return"data"in A&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+A.width+"x"+A.height+")."),A;return A}function p(A){return Ka(A.width)&&Ka(A.height)}function d(A){return o?!1:A.wrapS!==tn||A.wrapT!==tn||A.minFilter!==Ft&&A.minFilter!==jt}function M(A,S){return A.generateMipmaps&&S&&A.minFilter!==Ft&&A.minFilter!==jt}function v(A){i.generateMipmap(A)}function E(A,S,q,ae,le=!1){if(o===!1)return S;if(A!==null){if(i[A]!==void 0)return i[A];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let ce=S;if(S===i.RED&&(q===i.FLOAT&&(ce=i.R32F),q===i.HALF_FLOAT&&(ce=i.R16F),q===i.UNSIGNED_BYTE&&(ce=i.R8)),S===i.RED_INTEGER&&(q===i.UNSIGNED_BYTE&&(ce=i.R8UI),q===i.UNSIGNED_SHORT&&(ce=i.R16UI),q===i.UNSIGNED_INT&&(ce=i.R32UI),q===i.BYTE&&(ce=i.R8I),q===i.SHORT&&(ce=i.R16I),q===i.INT&&(ce=i.R32I)),S===i.RG&&(q===i.FLOAT&&(ce=i.RG32F),q===i.HALF_FLOAT&&(ce=i.RG16F),q===i.UNSIGNED_BYTE&&(ce=i.RG8)),S===i.RGBA){const Te=le?Ns:ut.getTransfer(ae);q===i.FLOAT&&(ce=i.RGBA32F),q===i.HALF_FLOAT&&(ce=i.RGBA16F),q===i.UNSIGNED_BYTE&&(ce=Te===ht?i.SRGB8_ALPHA8:i.RGBA8),q===i.UNSIGNED_SHORT_4_4_4_4&&(ce=i.RGBA4),q===i.UNSIGNED_SHORT_5_5_5_1&&(ce=i.RGB5_A1)}return(ce===i.R16F||ce===i.R32F||ce===i.RG16F||ce===i.RG32F||ce===i.RGBA16F||ce===i.RGBA32F)&&e.get("EXT_color_buffer_float"),ce}function T(A,S,q){return M(A,q)===!0||A.isFramebufferTexture&&A.minFilter!==Ft&&A.minFilter!==jt?Math.log2(Math.max(S.width,S.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?S.mipmaps.length:1}function w(A){return A===Ft||A===Ma||A===er?i.NEAREST:i.LINEAR}function y(A){const S=A.target;S.removeEventListener("dispose",y),x(S),S.isVideoTexture&&u.delete(S)}function L(A){const S=A.target;S.removeEventListener("dispose",L),N(S)}function x(A){const S=n.get(A);if(S.__webglInit===void 0)return;const q=A.source,ae=f.get(q);if(ae){const le=ae[S.__cacheKey];le.usedTimes--,le.usedTimes===0&&b(A),Object.keys(ae).length===0&&f.delete(q)}n.remove(A)}function b(A){const S=n.get(A);i.deleteTexture(S.__webglTexture);const q=A.source,ae=f.get(q);delete ae[S.__cacheKey],a.memory.textures--}function N(A){const S=A.texture,q=n.get(A),ae=n.get(S);if(ae.__webglTexture!==void 0&&(i.deleteTexture(ae.__webglTexture),a.memory.textures--),A.depthTexture&&A.depthTexture.dispose(),A.isWebGLCubeRenderTarget)for(let le=0;le<6;le++){if(Array.isArray(q.__webglFramebuffer[le]))for(let ce=0;ce<q.__webglFramebuffer[le].length;ce++)i.deleteFramebuffer(q.__webglFramebuffer[le][ce]);else i.deleteFramebuffer(q.__webglFramebuffer[le]);q.__webglDepthbuffer&&i.deleteRenderbuffer(q.__webglDepthbuffer[le])}else{if(Array.isArray(q.__webglFramebuffer))for(let le=0;le<q.__webglFramebuffer.length;le++)i.deleteFramebuffer(q.__webglFramebuffer[le]);else i.deleteFramebuffer(q.__webglFramebuffer);if(q.__webglDepthbuffer&&i.deleteRenderbuffer(q.__webglDepthbuffer),q.__webglMultisampledFramebuffer&&i.deleteFramebuffer(q.__webglMultisampledFramebuffer),q.__webglColorRenderbuffer)for(let le=0;le<q.__webglColorRenderbuffer.length;le++)q.__webglColorRenderbuffer[le]&&i.deleteRenderbuffer(q.__webglColorRenderbuffer[le]);q.__webglDepthRenderbuffer&&i.deleteRenderbuffer(q.__webglDepthRenderbuffer)}if(A.isWebGLMultipleRenderTargets)for(let le=0,ce=S.length;le<ce;le++){const Te=n.get(S[le]);Te.__webglTexture&&(i.deleteTexture(Te.__webglTexture),a.memory.textures--),n.remove(S[le])}n.remove(S),n.remove(A)}let O=0;function $(){O=0}function P(){const A=O;return A>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+s.maxTextures),O+=1,A}function U(A){const S=[];return S.push(A.wrapS),S.push(A.wrapT),S.push(A.wrapR||0),S.push(A.magFilter),S.push(A.minFilter),S.push(A.anisotropy),S.push(A.internalFormat),S.push(A.format),S.push(A.type),S.push(A.generateMipmaps),S.push(A.premultiplyAlpha),S.push(A.flipY),S.push(A.unpackAlignment),S.push(A.colorSpace),S.join()}function B(A,S){const q=n.get(A);if(A.isVideoTexture&&rt(A),A.isRenderTargetTexture===!1&&A.version>0&&q.__version!==A.version){const ae=A.image;if(ae===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(ae.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{pe(q,A,S);return}}t.bindTexture(i.TEXTURE_2D,q.__webglTexture,i.TEXTURE0+S)}function k(A,S){const q=n.get(A);if(A.version>0&&q.__version!==A.version){pe(q,A,S);return}t.bindTexture(i.TEXTURE_2D_ARRAY,q.__webglTexture,i.TEXTURE0+S)}function X(A,S){const q=n.get(A);if(A.version>0&&q.__version!==A.version){pe(q,A,S);return}t.bindTexture(i.TEXTURE_3D,q.__webglTexture,i.TEXTURE0+S)}function V(A,S){const q=n.get(A);if(A.version>0&&q.__version!==A.version){oe(q,A,S);return}t.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture,i.TEXTURE0+S)}const z={[Xr]:i.REPEAT,[tn]:i.CLAMP_TO_EDGE,[qr]:i.MIRRORED_REPEAT},ne={[Ft]:i.NEAREST,[Ma]:i.NEAREST_MIPMAP_NEAREST,[er]:i.NEAREST_MIPMAP_LINEAR,[jt]:i.LINEAR,[zc]:i.LINEAR_MIPMAP_NEAREST,[Qi]:i.LINEAR_MIPMAP_LINEAR},_e={[Jc]:i.NEVER,[iu]:i.ALWAYS,[Qc]:i.LESS,[wl]:i.LEQUAL,[$c]:i.EQUAL,[nu]:i.GEQUAL,[eu]:i.GREATER,[tu]:i.NOTEQUAL};function Y(A,S,q){if(q?(i.texParameteri(A,i.TEXTURE_WRAP_S,z[S.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,z[S.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,z[S.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,ne[S.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,ne[S.minFilter])):(i.texParameteri(A,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(A,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,i.CLAMP_TO_EDGE),(S.wrapS!==tn||S.wrapT!==tn)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),i.texParameteri(A,i.TEXTURE_MAG_FILTER,w(S.magFilter)),i.texParameteri(A,i.TEXTURE_MIN_FILTER,w(S.minFilter)),S.minFilter!==Ft&&S.minFilter!==jt&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),S.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,_e[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){const ae=e.get("EXT_texture_filter_anisotropic");if(S.magFilter===Ft||S.minFilter!==er&&S.minFilter!==Qi||S.type===Un&&e.has("OES_texture_float_linear")===!1||o===!1&&S.type===$i&&e.has("OES_texture_half_float_linear")===!1)return;(S.anisotropy>1||n.get(S).__currentAnisotropy)&&(i.texParameterf(A,ae.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,s.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy)}}function ee(A,S){let q=!1;A.__webglInit===void 0&&(A.__webglInit=!0,S.addEventListener("dispose",y));const ae=S.source;let le=f.get(ae);le===void 0&&(le={},f.set(ae,le));const ce=U(S);if(ce!==A.__cacheKey){le[ce]===void 0&&(le[ce]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,q=!0),le[ce].usedTimes++;const Te=le[A.__cacheKey];Te!==void 0&&(le[A.__cacheKey].usedTimes--,Te.usedTimes===0&&b(S)),A.__cacheKey=ce,A.__webglTexture=le[ce].texture}return q}function pe(A,S,q){let ae=i.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(ae=i.TEXTURE_2D_ARRAY),S.isData3DTexture&&(ae=i.TEXTURE_3D);const le=ee(A,S),ce=S.source;t.bindTexture(ae,A.__webglTexture,i.TEXTURE0+q);const Te=n.get(ce);if(ce.version!==Te.__version||le===!0){t.activeTexture(i.TEXTURE0+q);const xe=ut.getPrimaries(ut.workingColorSpace),ge=S.colorSpace===Zt?null:ut.getPrimaries(S.colorSpace),Ie=S.colorSpace===Zt||xe===ge?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ie);const Ge=d(S)&&p(S.image)===!1;let ie=g(S.image,Ge,!1,s.maxTextureSize);ie=Be(S,ie);const ke=p(ie)||o,se=r.convert(S.format,S.colorSpace);let me=r.convert(S.type),Ae=E(S.internalFormat,se,me,S.colorSpace,S.isVideoTexture);Y(ae,S,ke);let Se;const C=S.mipmaps,he=o&&S.isVideoTexture!==!0&&Ae!==bl,Ce=Te.__version===void 0||le===!0,be=T(S,ie,ke);if(S.isDepthTexture)Ae=i.DEPTH_COMPONENT,o?S.type===Un?Ae=i.DEPTH_COMPONENT32F:S.type===In?Ae=i.DEPTH_COMPONENT24:S.type===Qn?Ae=i.DEPTH24_STENCIL8:Ae=i.DEPTH_COMPONENT16:S.type===Un&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),S.format===$n&&Ae===i.DEPTH_COMPONENT&&S.type!==na&&S.type!==In&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),S.type=In,me=r.convert(S.type)),S.format===Ii&&Ae===i.DEPTH_COMPONENT&&(Ae=i.DEPTH_STENCIL,S.type!==Qn&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),S.type=Qn,me=r.convert(S.type))),Ce&&(he?t.texStorage2D(i.TEXTURE_2D,1,Ae,ie.width,ie.height):t.texImage2D(i.TEXTURE_2D,0,Ae,ie.width,ie.height,0,se,me,null));else if(S.isDataTexture)if(C.length>0&&ke){he&&Ce&&t.texStorage2D(i.TEXTURE_2D,be,Ae,C[0].width,C[0].height);for(let re=0,I=C.length;re<I;re++)Se=C[re],he?t.texSubImage2D(i.TEXTURE_2D,re,0,0,Se.width,Se.height,se,me,Se.data):t.texImage2D(i.TEXTURE_2D,re,Ae,Se.width,Se.height,0,se,me,Se.data);S.generateMipmaps=!1}else he?(Ce&&t.texStorage2D(i.TEXTURE_2D,be,Ae,ie.width,ie.height),t.texSubImage2D(i.TEXTURE_2D,0,0,0,ie.width,ie.height,se,me,ie.data)):t.texImage2D(i.TEXTURE_2D,0,Ae,ie.width,ie.height,0,se,me,ie.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){he&&Ce&&t.texStorage3D(i.TEXTURE_2D_ARRAY,be,Ae,C[0].width,C[0].height,ie.depth);for(let re=0,I=C.length;re<I;re++)Se=C[re],S.format!==nn?se!==null?he?t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,re,0,0,0,Se.width,Se.height,ie.depth,se,Se.data,0,0):t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,re,Ae,Se.width,Se.height,ie.depth,0,Se.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):he?t.texSubImage3D(i.TEXTURE_2D_ARRAY,re,0,0,0,Se.width,Se.height,ie.depth,se,me,Se.data):t.texImage3D(i.TEXTURE_2D_ARRAY,re,Ae,Se.width,Se.height,ie.depth,0,se,me,Se.data)}else{he&&Ce&&t.texStorage2D(i.TEXTURE_2D,be,Ae,C[0].width,C[0].height);for(let re=0,I=C.length;re<I;re++)Se=C[re],S.format!==nn?se!==null?he?t.compressedTexSubImage2D(i.TEXTURE_2D,re,0,0,Se.width,Se.height,se,Se.data):t.compressedTexImage2D(i.TEXTURE_2D,re,Ae,Se.width,Se.height,0,Se.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):he?t.texSubImage2D(i.TEXTURE_2D,re,0,0,Se.width,Se.height,se,me,Se.data):t.texImage2D(i.TEXTURE_2D,re,Ae,Se.width,Se.height,0,se,me,Se.data)}else if(S.isDataArrayTexture)he?(Ce&&t.texStorage3D(i.TEXTURE_2D_ARRAY,be,Ae,ie.width,ie.height,ie.depth),t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ie.width,ie.height,ie.depth,se,me,ie.data)):t.texImage3D(i.TEXTURE_2D_ARRAY,0,Ae,ie.width,ie.height,ie.depth,0,se,me,ie.data);else if(S.isData3DTexture)he?(Ce&&t.texStorage3D(i.TEXTURE_3D,be,Ae,ie.width,ie.height,ie.depth),t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ie.width,ie.height,ie.depth,se,me,ie.data)):t.texImage3D(i.TEXTURE_3D,0,Ae,ie.width,ie.height,ie.depth,0,se,me,ie.data);else if(S.isFramebufferTexture){if(Ce)if(he)t.texStorage2D(i.TEXTURE_2D,be,Ae,ie.width,ie.height);else{let re=ie.width,I=ie.height;for(let de=0;de<be;de++)t.texImage2D(i.TEXTURE_2D,de,Ae,re,I,0,se,me,null),re>>=1,I>>=1}}else if(C.length>0&&ke){he&&Ce&&t.texStorage2D(i.TEXTURE_2D,be,Ae,C[0].width,C[0].height);for(let re=0,I=C.length;re<I;re++)Se=C[re],he?t.texSubImage2D(i.TEXTURE_2D,re,0,0,se,me,Se):t.texImage2D(i.TEXTURE_2D,re,Ae,se,me,Se);S.generateMipmaps=!1}else he?(Ce&&t.texStorage2D(i.TEXTURE_2D,be,Ae,ie.width,ie.height),t.texSubImage2D(i.TEXTURE_2D,0,0,0,se,me,ie)):t.texImage2D(i.TEXTURE_2D,0,Ae,se,me,ie);M(S,ke)&&v(ae),Te.__version=ce.version,S.onUpdate&&S.onUpdate(S)}A.__version=S.version}function oe(A,S,q){if(S.image.length!==6)return;const ae=ee(A,S),le=S.source;t.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+q);const ce=n.get(le);if(le.version!==ce.__version||ae===!0){t.activeTexture(i.TEXTURE0+q);const Te=ut.getPrimaries(ut.workingColorSpace),xe=S.colorSpace===Zt?null:ut.getPrimaries(S.colorSpace),ge=S.colorSpace===Zt||Te===xe?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ge);const Ie=S.isCompressedTexture||S.image[0].isCompressedTexture,Ge=S.image[0]&&S.image[0].isDataTexture,ie=[];for(let re=0;re<6;re++)!Ie&&!Ge?ie[re]=g(S.image[re],!1,!0,s.maxCubemapSize):ie[re]=Ge?S.image[re].image:S.image[re],ie[re]=Be(S,ie[re]);const ke=ie[0],se=p(ke)||o,me=r.convert(S.format,S.colorSpace),Ae=r.convert(S.type),Se=E(S.internalFormat,me,Ae,S.colorSpace),C=o&&S.isVideoTexture!==!0,he=ce.__version===void 0||ae===!0;let Ce=T(S,ke,se);Y(i.TEXTURE_CUBE_MAP,S,se);let be;if(Ie){C&&he&&t.texStorage2D(i.TEXTURE_CUBE_MAP,Ce,Se,ke.width,ke.height);for(let re=0;re<6;re++){be=ie[re].mipmaps;for(let I=0;I<be.length;I++){const de=be[I];S.format!==nn?me!==null?C?t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I,0,0,de.width,de.height,me,de.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I,Se,de.width,de.height,0,de.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):C?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I,0,0,de.width,de.height,me,Ae,de.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I,Se,de.width,de.height,0,me,Ae,de.data)}}}else{be=S.mipmaps,C&&he&&(be.length>0&&Ce++,t.texStorage2D(i.TEXTURE_CUBE_MAP,Ce,Se,ie[0].width,ie[0].height));for(let re=0;re<6;re++)if(Ge){C?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,ie[re].width,ie[re].height,me,Ae,ie[re].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,Se,ie[re].width,ie[re].height,0,me,Ae,ie[re].data);for(let I=0;I<be.length;I++){const ve=be[I].image[re].image;C?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I+1,0,0,ve.width,ve.height,me,Ae,ve.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I+1,Se,ve.width,ve.height,0,me,Ae,ve.data)}}else{C?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,me,Ae,ie[re]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,Se,me,Ae,ie[re]);for(let I=0;I<be.length;I++){const de=be[I];C?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I+1,0,0,me,Ae,de.image[re]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,I+1,Se,me,Ae,de.image[re])}}}M(S,se)&&v(i.TEXTURE_CUBE_MAP),ce.__version=le.version,S.onUpdate&&S.onUpdate(S)}A.__version=S.version}function ue(A,S,q,ae,le,ce){const Te=r.convert(q.format,q.colorSpace),xe=r.convert(q.type),ge=E(q.internalFormat,Te,xe,q.colorSpace);if(!n.get(S).__hasExternalTextures){const Ge=Math.max(1,S.width>>ce),ie=Math.max(1,S.height>>ce);le===i.TEXTURE_3D||le===i.TEXTURE_2D_ARRAY?t.texImage3D(le,ce,ge,Ge,ie,S.depth,0,Te,xe,null):t.texImage2D(le,ce,ge,Ge,ie,0,Te,xe,null)}t.bindFramebuffer(i.FRAMEBUFFER,A),De(S)?l.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ae,le,n.get(q).__webglTexture,0,Re(S)):(le===i.TEXTURE_2D||le>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&le<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,ae,le,n.get(q).__webglTexture,ce),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Pe(A,S,q){if(i.bindRenderbuffer(i.RENDERBUFFER,A),S.depthBuffer&&!S.stencilBuffer){let ae=o===!0?i.DEPTH_COMPONENT24:i.DEPTH_COMPONENT16;if(q||De(S)){const le=S.depthTexture;le&&le.isDepthTexture&&(le.type===Un?ae=i.DEPTH_COMPONENT32F:le.type===In&&(ae=i.DEPTH_COMPONENT24));const ce=Re(S);De(S)?l.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ce,ae,S.width,S.height):i.renderbufferStorageMultisample(i.RENDERBUFFER,ce,ae,S.width,S.height)}else i.renderbufferStorage(i.RENDERBUFFER,ae,S.width,S.height);i.framebufferRenderbuffer(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.RENDERBUFFER,A)}else if(S.depthBuffer&&S.stencilBuffer){const ae=Re(S);q&&De(S)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,ae,i.DEPTH24_STENCIL8,S.width,S.height):De(S)?l.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ae,i.DEPTH24_STENCIL8,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,i.DEPTH_STENCIL,S.width,S.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.RENDERBUFFER,A)}else{const ae=S.isWebGLMultipleRenderTargets===!0?S.texture:[S.texture];for(let le=0;le<ae.length;le++){const ce=ae[le],Te=r.convert(ce.format,ce.colorSpace),xe=r.convert(ce.type),ge=E(ce.internalFormat,Te,xe,ce.colorSpace),Ie=Re(S);q&&De(S)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Ie,ge,S.width,S.height):De(S)?l.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Ie,ge,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,ge,S.width,S.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Oe(A,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,A),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),B(S.depthTexture,0);const ae=n.get(S.depthTexture).__webglTexture,le=Re(S);if(S.depthTexture.format===$n)De(S)?l.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,ae,0,le):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,ae,0);else if(S.depthTexture.format===Ii)De(S)?l.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,ae,0,le):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,ae,0);else throw new Error("Unknown depthTexture format")}function Ue(A){const S=n.get(A),q=A.isWebGLCubeRenderTarget===!0;if(A.depthTexture&&!S.__autoAllocateDepthBuffer){if(q)throw new Error("target.depthTexture not supported in Cube render targets");Oe(S.__webglFramebuffer,A)}else if(q){S.__webglDepthbuffer=[];for(let ae=0;ae<6;ae++)t.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer[ae]),S.__webglDepthbuffer[ae]=i.createRenderbuffer(),Pe(S.__webglDepthbuffer[ae],A,!1)}else t.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer=i.createRenderbuffer(),Pe(S.__webglDepthbuffer,A,!1);t.bindFramebuffer(i.FRAMEBUFFER,null)}function He(A,S,q){const ae=n.get(A);S!==void 0&&ue(ae.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),q!==void 0&&Ue(A)}function W(A){const S=A.texture,q=n.get(A),ae=n.get(S);A.addEventListener("dispose",L),A.isWebGLMultipleRenderTargets!==!0&&(ae.__webglTexture===void 0&&(ae.__webglTexture=i.createTexture()),ae.__version=S.version,a.memory.textures++);const le=A.isWebGLCubeRenderTarget===!0,ce=A.isWebGLMultipleRenderTargets===!0,Te=p(A)||o;if(le){q.__webglFramebuffer=[];for(let xe=0;xe<6;xe++)if(o&&S.mipmaps&&S.mipmaps.length>0){q.__webglFramebuffer[xe]=[];for(let ge=0;ge<S.mipmaps.length;ge++)q.__webglFramebuffer[xe][ge]=i.createFramebuffer()}else q.__webglFramebuffer[xe]=i.createFramebuffer()}else{if(o&&S.mipmaps&&S.mipmaps.length>0){q.__webglFramebuffer=[];for(let xe=0;xe<S.mipmaps.length;xe++)q.__webglFramebuffer[xe]=i.createFramebuffer()}else q.__webglFramebuffer=i.createFramebuffer();if(ce)if(s.drawBuffers){const xe=A.texture;for(let ge=0,Ie=xe.length;ge<Ie;ge++){const Ge=n.get(xe[ge]);Ge.__webglTexture===void 0&&(Ge.__webglTexture=i.createTexture(),a.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&A.samples>0&&De(A)===!1){const xe=ce?S:[S];q.__webglMultisampledFramebuffer=i.createFramebuffer(),q.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,q.__webglMultisampledFramebuffer);for(let ge=0;ge<xe.length;ge++){const Ie=xe[ge];q.__webglColorRenderbuffer[ge]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,q.__webglColorRenderbuffer[ge]);const Ge=r.convert(Ie.format,Ie.colorSpace),ie=r.convert(Ie.type),ke=E(Ie.internalFormat,Ge,ie,Ie.colorSpace,A.isXRRenderTarget===!0),se=Re(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,se,ke,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ge,i.RENDERBUFFER,q.__webglColorRenderbuffer[ge])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(q.__webglDepthRenderbuffer=i.createRenderbuffer(),Pe(q.__webglDepthRenderbuffer,A,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(le){t.bindTexture(i.TEXTURE_CUBE_MAP,ae.__webglTexture),Y(i.TEXTURE_CUBE_MAP,S,Te);for(let xe=0;xe<6;xe++)if(o&&S.mipmaps&&S.mipmaps.length>0)for(let ge=0;ge<S.mipmaps.length;ge++)ue(q.__webglFramebuffer[xe][ge],A,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+xe,ge);else ue(q.__webglFramebuffer[xe],A,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+xe,0);M(S,Te)&&v(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ce){const xe=A.texture;for(let ge=0,Ie=xe.length;ge<Ie;ge++){const Ge=xe[ge],ie=n.get(Ge);t.bindTexture(i.TEXTURE_2D,ie.__webglTexture),Y(i.TEXTURE_2D,Ge,Te),ue(q.__webglFramebuffer,A,Ge,i.COLOR_ATTACHMENT0+ge,i.TEXTURE_2D,0),M(Ge,Te)&&v(i.TEXTURE_2D)}t.unbindTexture()}else{let xe=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(o?xe=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),t.bindTexture(xe,ae.__webglTexture),Y(xe,S,Te),o&&S.mipmaps&&S.mipmaps.length>0)for(let ge=0;ge<S.mipmaps.length;ge++)ue(q.__webglFramebuffer[ge],A,S,i.COLOR_ATTACHMENT0,xe,ge);else ue(q.__webglFramebuffer,A,S,i.COLOR_ATTACHMENT0,xe,0);M(S,Te)&&v(xe),t.unbindTexture()}A.depthBuffer&&Ue(A)}function lt(A){const S=p(A)||o,q=A.isWebGLMultipleRenderTargets===!0?A.texture:[A.texture];for(let ae=0,le=q.length;ae<le;ae++){const ce=q[ae];if(M(ce,S)){const Te=A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:i.TEXTURE_2D,xe=n.get(ce).__webglTexture;t.bindTexture(Te,xe),v(Te),t.unbindTexture()}}}function we(A){if(o&&A.samples>0&&De(A)===!1){const S=A.isWebGLMultipleRenderTargets?A.texture:[A.texture],q=A.width,ae=A.height;let le=i.COLOR_BUFFER_BIT;const ce=[],Te=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,xe=n.get(A),ge=A.isWebGLMultipleRenderTargets===!0;if(ge)for(let Ie=0;Ie<S.length;Ie++)t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ie,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ie,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,xe.__webglMultisampledFramebuffer),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglFramebuffer);for(let Ie=0;Ie<S.length;Ie++){ce.push(i.COLOR_ATTACHMENT0+Ie),A.depthBuffer&&ce.push(Te);const Ge=xe.__ignoreDepthValues!==void 0?xe.__ignoreDepthValues:!1;if(Ge===!1&&(A.depthBuffer&&(le|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&(le|=i.STENCIL_BUFFER_BIT)),ge&&i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,xe.__webglColorRenderbuffer[Ie]),Ge===!0&&(i.invalidateFramebuffer(i.READ_FRAMEBUFFER,[Te]),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[Te])),ge){const ie=n.get(S[Ie]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,ie,0)}i.blitFramebuffer(0,0,q,ae,0,0,q,ae,le,i.NEAREST),c&&i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ce)}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ge)for(let Ie=0;Ie<S.length;Ie++){t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ie,i.RENDERBUFFER,xe.__webglColorRenderbuffer[Ie]);const Ge=n.get(S[Ie]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,xe.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ie,i.TEXTURE_2D,Ge,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,xe.__webglMultisampledFramebuffer)}}function Re(A){return Math.min(s.maxSamples,A.samples)}function De(A){const S=n.get(A);return o&&A.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function rt(A){const S=a.render.frame;u.get(A)!==S&&(u.set(A,S),A.update())}function Be(A,S){const q=A.colorSpace,ae=A.format,le=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||A.format===Yr||q!==Sn&&q!==Zt&&(ut.getTransfer(q)===ht?o===!1?e.has("EXT_sRGB")===!0&&ae===nn?(A.format=Yr,A.minFilter=jt,A.generateMipmaps=!1):S=Cl.sRGBToLinear(S):(ae!==nn||le!==On)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",q)),S}this.allocateTextureUnit=P,this.resetTextureUnits=$,this.setTexture2D=B,this.setTexture2DArray=k,this.setTexture3D=X,this.setTextureCube=V,this.rebindTextures=He,this.setupRenderTarget=W,this.updateRenderTargetMipmap=lt,this.updateMultisampleRenderTarget=we,this.setupDepthRenderbuffer=Ue,this.setupFrameBufferTexture=ue,this.useMultisampledRTT=De}function am(i,e,t){const n=t.isWebGL2;function s(r,a=Zt){let o;const l=ut.getTransfer(a);if(r===On)return i.UNSIGNED_BYTE;if(r===xl)return i.UNSIGNED_SHORT_4_4_4_4;if(r===Ml)return i.UNSIGNED_SHORT_5_5_5_1;if(r===Hc)return i.BYTE;if(r===kc)return i.SHORT;if(r===na)return i.UNSIGNED_SHORT;if(r===vl)return i.INT;if(r===In)return i.UNSIGNED_INT;if(r===Un)return i.FLOAT;if(r===$i)return n?i.HALF_FLOAT:(o=e.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(r===Gc)return i.ALPHA;if(r===nn)return i.RGBA;if(r===Vc)return i.LUMINANCE;if(r===Wc)return i.LUMINANCE_ALPHA;if(r===$n)return i.DEPTH_COMPONENT;if(r===Ii)return i.DEPTH_STENCIL;if(r===Yr)return o=e.get("EXT_sRGB"),o!==null?o.SRGB_ALPHA_EXT:null;if(r===Xc)return i.RED;if(r===Sl)return i.RED_INTEGER;if(r===qc)return i.RG;if(r===El)return i.RG_INTEGER;if(r===yl)return i.RGBA_INTEGER;if(r===tr||r===nr||r===ir||r===sr)if(l===ht)if(o=e.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(r===tr)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(r===nr)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(r===ir)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(r===sr)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=e.get("WEBGL_compressed_texture_s3tc"),o!==null){if(r===tr)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(r===nr)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(r===ir)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(r===sr)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(r===Sa||r===Ea||r===ya||r===ba)if(o=e.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(r===Sa)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(r===Ea)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(r===ya)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(r===ba)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(r===bl)return o=e.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if(r===Ta||r===Aa)if(o=e.get("WEBGL_compressed_texture_etc"),o!==null){if(r===Ta)return l===ht?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(r===Aa)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(r===wa||r===Ra||r===Ca||r===Pa||r===La||r===Da||r===Ia||r===Ua||r===Na||r===Fa||r===Oa||r===Ba||r===za||r===Ha)if(o=e.get("WEBGL_compressed_texture_astc"),o!==null){if(r===wa)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(r===Ra)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(r===Ca)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(r===Pa)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(r===La)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(r===Da)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(r===Ia)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(r===Ua)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(r===Na)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(r===Fa)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(r===Oa)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(r===Ba)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(r===za)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(r===Ha)return l===ht?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(r===rr||r===ka||r===Ga)if(o=e.get("EXT_texture_compression_bptc"),o!==null){if(r===rr)return l===ht?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(r===ka)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(r===Ga)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(r===Yc||r===Va||r===Wa||r===Xa)if(o=e.get("EXT_texture_compression_rgtc"),o!==null){if(r===rr)return o.COMPRESSED_RED_RGTC1_EXT;if(r===Va)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(r===Wa)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(r===Xa)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return r===Qn?n?i.UNSIGNED_INT_24_8:(o=e.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null):i[r]!==void 0?i[r]:null}return{convert:s}}class om extends Wt{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}}class Jn extends Rt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const lm={type:"move"};class Cr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Jn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Jn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new F,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new F),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Jn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new F,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new F),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const g of e.hand.values()){const p=t.getJointPose(g,n),d=this._getHandJoint(c,g);p!==null&&(d.matrix.fromArray(p.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,d.jointRadius=p.radius),d.visible=p!==null}const u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],f=u.position.distanceTo(h.position),m=.02,_=.005;c.inputState.pinching&&f>m+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&f<=m-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(lm)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new Jn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}class cm extends ri{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,u=null,h=null,f=null,m=null,_=null;const g=t.getContextAttributes();let p=null,d=null;const M=[],v=[],E=new qe;let T=null;const w=new Wt;w.layers.enable(1),w.viewport=new pt;const y=new Wt;y.layers.enable(2),y.viewport=new pt;const L=[w,y],x=new om;x.layers.enable(1),x.layers.enable(2);let b=null,N=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let ee=M[Y];return ee===void 0&&(ee=new Cr,M[Y]=ee),ee.getTargetRaySpace()},this.getControllerGrip=function(Y){let ee=M[Y];return ee===void 0&&(ee=new Cr,M[Y]=ee),ee.getGripSpace()},this.getHand=function(Y){let ee=M[Y];return ee===void 0&&(ee=new Cr,M[Y]=ee),ee.getHandSpace()};function O(Y){const ee=v.indexOf(Y.inputSource);if(ee===-1)return;const pe=M[ee];pe!==void 0&&(pe.update(Y.inputSource,Y.frame,c||a),pe.dispatchEvent({type:Y.type,data:Y.inputSource}))}function $(){s.removeEventListener("select",O),s.removeEventListener("selectstart",O),s.removeEventListener("selectend",O),s.removeEventListener("squeeze",O),s.removeEventListener("squeezestart",O),s.removeEventListener("squeezeend",O),s.removeEventListener("end",$),s.removeEventListener("inputsourceschange",P);for(let Y=0;Y<M.length;Y++){const ee=v[Y];ee!==null&&(v[Y]=null,M[Y].disconnect(ee))}b=null,N=null,e.setRenderTarget(p),m=null,f=null,h=null,s=null,d=null,_e.stop(),n.isPresenting=!1,e.setPixelRatio(T),e.setSize(E.width,E.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return f!==null?f:m},this.getBinding=function(){return h},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(p=e.getRenderTarget(),s.addEventListener("select",O),s.addEventListener("selectstart",O),s.addEventListener("selectend",O),s.addEventListener("squeeze",O),s.addEventListener("squeezestart",O),s.addEventListener("squeezeend",O),s.addEventListener("end",$),s.addEventListener("inputsourceschange",P),g.xrCompatible!==!0&&await t.makeXRCompatible(),T=e.getPixelRatio(),e.getSize(E),s.renderState.layers===void 0||e.capabilities.isWebGL2===!1){const ee={antialias:s.renderState.layers===void 0?g.antialias:!0,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(s,t,ee),s.updateRenderState({baseLayer:m}),e.setPixelRatio(1),e.setSize(m.framebufferWidth,m.framebufferHeight,!1),d=new ti(m.framebufferWidth,m.framebufferHeight,{format:nn,type:On,colorSpace:e.outputColorSpace,stencilBuffer:g.stencil})}else{let ee=null,pe=null,oe=null;g.depth&&(oe=g.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ee=g.stencil?Ii:$n,pe=g.stencil?Qn:In);const ue={colorFormat:t.RGBA8,depthFormat:oe,scaleFactor:r};h=new XRWebGLBinding(s,t),f=h.createProjectionLayer(ue),s.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),d=new ti(f.textureWidth,f.textureHeight,{format:nn,type:On,depthTexture:new Gl(f.textureWidth,f.textureHeight,pe,void 0,void 0,void 0,void 0,void 0,void 0,ee),stencilBuffer:g.stencil,colorSpace:e.outputColorSpace,samples:g.antialias?4:0});const Pe=e.properties.get(d);Pe.__ignoreDepthValues=f.ignoreDepthValues}d.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),_e.setContext(s),_e.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode};function P(Y){for(let ee=0;ee<Y.removed.length;ee++){const pe=Y.removed[ee],oe=v.indexOf(pe);oe>=0&&(v[oe]=null,M[oe].disconnect(pe))}for(let ee=0;ee<Y.added.length;ee++){const pe=Y.added[ee];let oe=v.indexOf(pe);if(oe===-1){for(let Pe=0;Pe<M.length;Pe++)if(Pe>=v.length){v.push(pe),oe=Pe;break}else if(v[Pe]===null){v[Pe]=pe,oe=Pe;break}if(oe===-1)break}const ue=M[oe];ue&&ue.connect(pe)}}const U=new F,B=new F;function k(Y,ee,pe){U.setFromMatrixPosition(ee.matrixWorld),B.setFromMatrixPosition(pe.matrixWorld);const oe=U.distanceTo(B),ue=ee.projectionMatrix.elements,Pe=pe.projectionMatrix.elements,Oe=ue[14]/(ue[10]-1),Ue=ue[14]/(ue[10]+1),He=(ue[9]+1)/ue[5],W=(ue[9]-1)/ue[5],lt=(ue[8]-1)/ue[0],we=(Pe[8]+1)/Pe[0],Re=Oe*lt,De=Oe*we,rt=oe/(-lt+we),Be=rt*-lt;ee.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(Be),Y.translateZ(rt),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert();const A=Oe+rt,S=Ue+rt,q=Re-Be,ae=De+(oe-Be),le=He*Ue/S*A,ce=W*Ue/S*A;Y.projectionMatrix.makePerspective(q,ae,le,ce,A,S),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}function X(Y,ee){ee===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(ee.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;x.near=y.near=w.near=Y.near,x.far=y.far=w.far=Y.far,(b!==x.near||N!==x.far)&&(s.updateRenderState({depthNear:x.near,depthFar:x.far}),b=x.near,N=x.far);const ee=Y.parent,pe=x.cameras;X(x,ee);for(let oe=0;oe<pe.length;oe++)X(pe[oe],ee);pe.length===2?k(x,w,y):x.projectionMatrix.copy(w.projectionMatrix),V(Y,x,ee)};function V(Y,ee,pe){pe===null?Y.matrix.copy(ee.matrixWorld):(Y.matrix.copy(pe.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(ee.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(ee.projectionMatrix),Y.projectionMatrixInverse.copy(ee.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=jr*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return x},this.getFoveation=function(){if(!(f===null&&m===null))return l},this.setFoveation=function(Y){l=Y,f!==null&&(f.fixedFoveation=Y),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=Y)};let z=null;function ne(Y,ee){if(u=ee.getViewerPose(c||a),_=ee,u!==null){const pe=u.views;m!==null&&(e.setRenderTargetFramebuffer(d,m.framebuffer),e.setRenderTarget(d));let oe=!1;pe.length!==x.cameras.length&&(x.cameras.length=0,oe=!0);for(let ue=0;ue<pe.length;ue++){const Pe=pe[ue];let Oe=null;if(m!==null)Oe=m.getViewport(Pe);else{const He=h.getViewSubImage(f,Pe);Oe=He.viewport,ue===0&&(e.setRenderTargetTextures(d,He.colorTexture,f.ignoreDepthValues?void 0:He.depthStencilTexture),e.setRenderTarget(d))}let Ue=L[ue];Ue===void 0&&(Ue=new Wt,Ue.layers.enable(ue),Ue.viewport=new pt,L[ue]=Ue),Ue.matrix.fromArray(Pe.transform.matrix),Ue.matrix.decompose(Ue.position,Ue.quaternion,Ue.scale),Ue.projectionMatrix.fromArray(Pe.projectionMatrix),Ue.projectionMatrixInverse.copy(Ue.projectionMatrix).invert(),Ue.viewport.set(Oe.x,Oe.y,Oe.width,Oe.height),ue===0&&(x.matrix.copy(Ue.matrix),x.matrix.decompose(x.position,x.quaternion,x.scale)),oe===!0&&x.cameras.push(Ue)}}for(let pe=0;pe<M.length;pe++){const oe=v[pe],ue=M[pe];oe!==null&&ue!==void 0&&ue.update(oe,ee,c||a)}z&&z(Y,ee),ee.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ee}),_=null}const _e=new Hl;_e.setAnimationLoop(ne),this.setAnimationLoop=function(Y){z=Y},this.dispose=function(){}}}function um(i,e){function t(p,d){p.matrixAutoUpdate===!0&&p.updateMatrix(),d.value.copy(p.matrix)}function n(p,d){d.color.getRGB(p.fogColor.value,Ol(i)),d.isFog?(p.fogNear.value=d.near,p.fogFar.value=d.far):d.isFogExp2&&(p.fogDensity.value=d.density)}function s(p,d,M,v,E){d.isMeshBasicMaterial||d.isMeshLambertMaterial?r(p,d):d.isMeshToonMaterial?(r(p,d),h(p,d)):d.isMeshPhongMaterial?(r(p,d),u(p,d)):d.isMeshStandardMaterial?(r(p,d),f(p,d),d.isMeshPhysicalMaterial&&m(p,d,E)):d.isMeshMatcapMaterial?(r(p,d),_(p,d)):d.isMeshDepthMaterial?r(p,d):d.isMeshDistanceMaterial?(r(p,d),g(p,d)):d.isMeshNormalMaterial?r(p,d):d.isLineBasicMaterial?(a(p,d),d.isLineDashedMaterial&&o(p,d)):d.isPointsMaterial?l(p,d,M,v):d.isSpriteMaterial?c(p,d):d.isShadowMaterial?(p.color.value.copy(d.color),p.opacity.value=d.opacity):d.isShaderMaterial&&(d.uniformsNeedUpdate=!1)}function r(p,d){p.opacity.value=d.opacity,d.color&&p.diffuse.value.copy(d.color),d.emissive&&p.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity),d.map&&(p.map.value=d.map,t(d.map,p.mapTransform)),d.alphaMap&&(p.alphaMap.value=d.alphaMap,t(d.alphaMap,p.alphaMapTransform)),d.bumpMap&&(p.bumpMap.value=d.bumpMap,t(d.bumpMap,p.bumpMapTransform),p.bumpScale.value=d.bumpScale,d.side===Ht&&(p.bumpScale.value*=-1)),d.normalMap&&(p.normalMap.value=d.normalMap,t(d.normalMap,p.normalMapTransform),p.normalScale.value.copy(d.normalScale),d.side===Ht&&p.normalScale.value.negate()),d.displacementMap&&(p.displacementMap.value=d.displacementMap,t(d.displacementMap,p.displacementMapTransform),p.displacementScale.value=d.displacementScale,p.displacementBias.value=d.displacementBias),d.emissiveMap&&(p.emissiveMap.value=d.emissiveMap,t(d.emissiveMap,p.emissiveMapTransform)),d.specularMap&&(p.specularMap.value=d.specularMap,t(d.specularMap,p.specularMapTransform)),d.alphaTest>0&&(p.alphaTest.value=d.alphaTest);const M=e.get(d).envMap;if(M&&(p.envMap.value=M,p.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,p.reflectivity.value=d.reflectivity,p.ior.value=d.ior,p.refractionRatio.value=d.refractionRatio),d.lightMap){p.lightMap.value=d.lightMap;const v=i._useLegacyLights===!0?Math.PI:1;p.lightMapIntensity.value=d.lightMapIntensity*v,t(d.lightMap,p.lightMapTransform)}d.aoMap&&(p.aoMap.value=d.aoMap,p.aoMapIntensity.value=d.aoMapIntensity,t(d.aoMap,p.aoMapTransform))}function a(p,d){p.diffuse.value.copy(d.color),p.opacity.value=d.opacity,d.map&&(p.map.value=d.map,t(d.map,p.mapTransform))}function o(p,d){p.dashSize.value=d.dashSize,p.totalSize.value=d.dashSize+d.gapSize,p.scale.value=d.scale}function l(p,d,M,v){p.diffuse.value.copy(d.color),p.opacity.value=d.opacity,p.size.value=d.size*M,p.scale.value=v*.5,d.map&&(p.map.value=d.map,t(d.map,p.uvTransform)),d.alphaMap&&(p.alphaMap.value=d.alphaMap,t(d.alphaMap,p.alphaMapTransform)),d.alphaTest>0&&(p.alphaTest.value=d.alphaTest)}function c(p,d){p.diffuse.value.copy(d.color),p.opacity.value=d.opacity,p.rotation.value=d.rotation,d.map&&(p.map.value=d.map,t(d.map,p.mapTransform)),d.alphaMap&&(p.alphaMap.value=d.alphaMap,t(d.alphaMap,p.alphaMapTransform)),d.alphaTest>0&&(p.alphaTest.value=d.alphaTest)}function u(p,d){p.specular.value.copy(d.specular),p.shininess.value=Math.max(d.shininess,1e-4)}function h(p,d){d.gradientMap&&(p.gradientMap.value=d.gradientMap)}function f(p,d){p.metalness.value=d.metalness,d.metalnessMap&&(p.metalnessMap.value=d.metalnessMap,t(d.metalnessMap,p.metalnessMapTransform)),p.roughness.value=d.roughness,d.roughnessMap&&(p.roughnessMap.value=d.roughnessMap,t(d.roughnessMap,p.roughnessMapTransform)),e.get(d).envMap&&(p.envMapIntensity.value=d.envMapIntensity)}function m(p,d,M){p.ior.value=d.ior,d.sheen>0&&(p.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),p.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap&&(p.sheenColorMap.value=d.sheenColorMap,t(d.sheenColorMap,p.sheenColorMapTransform)),d.sheenRoughnessMap&&(p.sheenRoughnessMap.value=d.sheenRoughnessMap,t(d.sheenRoughnessMap,p.sheenRoughnessMapTransform))),d.clearcoat>0&&(p.clearcoat.value=d.clearcoat,p.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap&&(p.clearcoatMap.value=d.clearcoatMap,t(d.clearcoatMap,p.clearcoatMapTransform)),d.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,t(d.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),d.clearcoatNormalMap&&(p.clearcoatNormalMap.value=d.clearcoatNormalMap,t(d.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===Ht&&p.clearcoatNormalScale.value.negate())),d.iridescence>0&&(p.iridescence.value=d.iridescence,p.iridescenceIOR.value=d.iridescenceIOR,p.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap&&(p.iridescenceMap.value=d.iridescenceMap,t(d.iridescenceMap,p.iridescenceMapTransform)),d.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=d.iridescenceThicknessMap,t(d.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),d.transmission>0&&(p.transmission.value=d.transmission,p.transmissionSamplerMap.value=M.texture,p.transmissionSamplerSize.value.set(M.width,M.height),d.transmissionMap&&(p.transmissionMap.value=d.transmissionMap,t(d.transmissionMap,p.transmissionMapTransform)),p.thickness.value=d.thickness,d.thicknessMap&&(p.thicknessMap.value=d.thicknessMap,t(d.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=d.attenuationDistance,p.attenuationColor.value.copy(d.attenuationColor)),d.anisotropy>0&&(p.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap&&(p.anisotropyMap.value=d.anisotropyMap,t(d.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=d.specularIntensity,p.specularColor.value.copy(d.specularColor),d.specularColorMap&&(p.specularColorMap.value=d.specularColorMap,t(d.specularColorMap,p.specularColorMapTransform)),d.specularIntensityMap&&(p.specularIntensityMap.value=d.specularIntensityMap,t(d.specularIntensityMap,p.specularIntensityMapTransform))}function _(p,d){d.matcap&&(p.matcap.value=d.matcap)}function g(p,d){const M=e.get(d).light;p.referencePosition.value.setFromMatrixPosition(M.matrixWorld),p.nearDistance.value=M.shadow.camera.near,p.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function hm(i,e,t,n){let s={},r={},a=[];const o=t.isWebGL2?i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS):0;function l(M,v){const E=v.program;n.uniformBlockBinding(M,E)}function c(M,v){let E=s[M.id];E===void 0&&(_(M),E=u(M),s[M.id]=E,M.addEventListener("dispose",p));const T=v.program;n.updateUBOMapping(M,T);const w=e.render.frame;r[M.id]!==w&&(f(M),r[M.id]=w)}function u(M){const v=h();M.__bindingPointIndex=v;const E=i.createBuffer(),T=M.__size,w=M.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,T,w),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,v,E),E}function h(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(M){const v=s[M.id],E=M.uniforms,T=M.__cache;i.bindBuffer(i.UNIFORM_BUFFER,v);for(let w=0,y=E.length;w<y;w++){const L=Array.isArray(E[w])?E[w]:[E[w]];for(let x=0,b=L.length;x<b;x++){const N=L[x];if(m(N,w,x,T)===!0){const O=N.__offset,$=Array.isArray(N.value)?N.value:[N.value];let P=0;for(let U=0;U<$.length;U++){const B=$[U],k=g(B);typeof B=="number"||typeof B=="boolean"?(N.__data[0]=B,i.bufferSubData(i.UNIFORM_BUFFER,O+P,N.__data)):B.isMatrix3?(N.__data[0]=B.elements[0],N.__data[1]=B.elements[1],N.__data[2]=B.elements[2],N.__data[3]=0,N.__data[4]=B.elements[3],N.__data[5]=B.elements[4],N.__data[6]=B.elements[5],N.__data[7]=0,N.__data[8]=B.elements[6],N.__data[9]=B.elements[7],N.__data[10]=B.elements[8],N.__data[11]=0):(B.toArray(N.__data,P),P+=k.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,O,N.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function m(M,v,E,T){const w=M.value,y=v+"_"+E;if(T[y]===void 0)return typeof w=="number"||typeof w=="boolean"?T[y]=w:T[y]=w.clone(),!0;{const L=T[y];if(typeof w=="number"||typeof w=="boolean"){if(L!==w)return T[y]=w,!0}else if(L.equals(w)===!1)return L.copy(w),!0}return!1}function _(M){const v=M.uniforms;let E=0;const T=16;for(let y=0,L=v.length;y<L;y++){const x=Array.isArray(v[y])?v[y]:[v[y]];for(let b=0,N=x.length;b<N;b++){const O=x[b],$=Array.isArray(O.value)?O.value:[O.value];for(let P=0,U=$.length;P<U;P++){const B=$[P],k=g(B),X=E%T;X!==0&&T-X<k.boundary&&(E+=T-X),O.__data=new Float32Array(k.storage/Float32Array.BYTES_PER_ELEMENT),O.__offset=E,E+=k.storage}}}const w=E%T;return w>0&&(E+=T-w),M.__size=E,M.__cache={},this}function g(M){const v={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(v.boundary=4,v.storage=4):M.isVector2?(v.boundary=8,v.storage=8):M.isVector3||M.isColor?(v.boundary=16,v.storage=12):M.isVector4?(v.boundary=16,v.storage=16):M.isMatrix3?(v.boundary=48,v.storage=48):M.isMatrix4?(v.boundary=64,v.storage=64):M.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",M),v}function p(M){const v=M.target;v.removeEventListener("dispose",p);const E=a.indexOf(v.__bindingPointIndex);a.splice(E,1),i.deleteBuffer(s[v.id]),delete s[v.id],delete r[v.id]}function d(){for(const M in s)i.deleteBuffer(s[M]);a=[],s={},r={}}return{bind:l,update:c,dispose:d}}class jl{constructor(e={}){const{canvas:t=au(),context:n=null,depth:s=!0,stencil:r=!0,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:h=!1}=e;this.isWebGLRenderer=!0;let f;n!==null?f=n.getContextAttributes().alpha:f=a;const m=new Uint32Array(4),_=new Int32Array(4);let g=null,p=null;const d=[],M=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=wt,this._useLegacyLights=!1,this.toneMapping=Fn,this.toneMappingExposure=1;const v=this;let E=!1,T=0,w=0,y=null,L=-1,x=null;const b=new pt,N=new pt;let O=null;const $=new it(0);let P=0,U=t.width,B=t.height,k=1,X=null,V=null;const z=new pt(0,0,U,B),ne=new pt(0,0,U,B);let _e=!1;const Y=new ra;let ee=!1,pe=!1,oe=null;const ue=new Mt,Pe=new qe,Oe=new F,Ue={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function He(){return y===null?k:1}let W=n;function lt(R,G){for(let K=0;K<R.length;K++){const te=R[K],j=t.getContext(te,G);if(j!==null)return j}return null}try{const R={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${ta}`),t.addEventListener("webglcontextlost",re,!1),t.addEventListener("webglcontextrestored",I,!1),t.addEventListener("webglcontextcreationerror",de,!1),W===null){const G=["webgl2","webgl","experimental-webgl"];if(v.isWebGL1Renderer===!0&&G.shift(),W=lt(G,R),W===null)throw lt(G)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&W instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),W.getShaderPrecisionFormat===void 0&&(W.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(R){throw console.error("THREE.WebGLRenderer: "+R.message),R}let we,Re,De,rt,Be,A,S,q,ae,le,ce,Te,xe,ge,Ie,Ge,ie,ke,se,me,Ae,Se,C,he;function Ce(){we=new Sd(W),Re=new md(W,we,e),we.init(Re),Se=new am(W,we,Re),De=new sm(W,we,Re),rt=new bd(W),Be=new Wp,A=new rm(W,we,De,Be,Re,Se,rt),S=new gd(v),q=new Md(v),ae=new Lu(W,Re),C=new dd(W,we,ae,Re),le=new Ed(W,ae,rt,C),ce=new Rd(W,le,ae,rt),se=new wd(W,Re,A),Ge=new _d(Be),Te=new Vp(v,S,q,we,Re,C,Ge),xe=new um(v,Be),ge=new qp,Ie=new Qp(we,Re),ke=new fd(v,S,q,De,ce,f,l),ie=new im(v,ce,Re),he=new hm(W,rt,Re,De),me=new pd(W,we,rt,Re),Ae=new yd(W,we,rt,Re),rt.programs=Te.programs,v.capabilities=Re,v.extensions=we,v.properties=Be,v.renderLists=ge,v.shadowMap=ie,v.state=De,v.info=rt}Ce();const be=new cm(v,W);this.xr=be,this.getContext=function(){return W},this.getContextAttributes=function(){return W.getContextAttributes()},this.forceContextLoss=function(){const R=we.get("WEBGL_lose_context");R&&R.loseContext()},this.forceContextRestore=function(){const R=we.get("WEBGL_lose_context");R&&R.restoreContext()},this.getPixelRatio=function(){return k},this.setPixelRatio=function(R){R!==void 0&&(k=R,this.setSize(U,B,!1))},this.getSize=function(R){return R.set(U,B)},this.setSize=function(R,G,K=!0){if(be.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}U=R,B=G,t.width=Math.floor(R*k),t.height=Math.floor(G*k),K===!0&&(t.style.width=R+"px",t.style.height=G+"px"),this.setViewport(0,0,R,G)},this.getDrawingBufferSize=function(R){return R.set(U*k,B*k).floor()},this.setDrawingBufferSize=function(R,G,K){U=R,B=G,k=K,t.width=Math.floor(R*K),t.height=Math.floor(G*K),this.setViewport(0,0,R,G)},this.getCurrentViewport=function(R){return R.copy(b)},this.getViewport=function(R){return R.copy(z)},this.setViewport=function(R,G,K,te){R.isVector4?z.set(R.x,R.y,R.z,R.w):z.set(R,G,K,te),De.viewport(b.copy(z).multiplyScalar(k).floor())},this.getScissor=function(R){return R.copy(ne)},this.setScissor=function(R,G,K,te){R.isVector4?ne.set(R.x,R.y,R.z,R.w):ne.set(R,G,K,te),De.scissor(N.copy(ne).multiplyScalar(k).floor())},this.getScissorTest=function(){return _e},this.setScissorTest=function(R){De.setScissorTest(_e=R)},this.setOpaqueSort=function(R){X=R},this.setTransparentSort=function(R){V=R},this.getClearColor=function(R){return R.copy(ke.getClearColor())},this.setClearColor=function(){ke.setClearColor.apply(ke,arguments)},this.getClearAlpha=function(){return ke.getClearAlpha()},this.setClearAlpha=function(){ke.setClearAlpha.apply(ke,arguments)},this.clear=function(R=!0,G=!0,K=!0){let te=0;if(R){let j=!1;if(y!==null){const Le=y.texture.format;j=Le===yl||Le===El||Le===Sl}if(j){const Le=y.texture.type,ze=Le===On||Le===In||Le===na||Le===Qn||Le===xl||Le===Ml,We=ke.getClearColor(),Xe=ke.getClearAlpha(),et=We.r,Ze=We.g,Je=We.b;ze?(m[0]=et,m[1]=Ze,m[2]=Je,m[3]=Xe,W.clearBufferuiv(W.COLOR,0,m)):(_[0]=et,_[1]=Ze,_[2]=Je,_[3]=Xe,W.clearBufferiv(W.COLOR,0,_))}else te|=W.COLOR_BUFFER_BIT}G&&(te|=W.DEPTH_BUFFER_BIT),K&&(te|=W.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),W.clear(te)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",re,!1),t.removeEventListener("webglcontextrestored",I,!1),t.removeEventListener("webglcontextcreationerror",de,!1),ge.dispose(),Ie.dispose(),Be.dispose(),S.dispose(),q.dispose(),ce.dispose(),C.dispose(),he.dispose(),Te.dispose(),be.dispose(),be.removeEventListener("sessionstart",ft),be.removeEventListener("sessionend",st),oe&&(oe.dispose(),oe=null),mt.stop()};function re(R){R.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),E=!0}function I(){console.log("THREE.WebGLRenderer: Context Restored."),E=!1;const R=rt.autoReset,G=ie.enabled,K=ie.autoUpdate,te=ie.needsUpdate,j=ie.type;Ce(),rt.autoReset=R,ie.enabled=G,ie.autoUpdate=K,ie.needsUpdate=te,ie.type=j}function de(R){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",R.statusMessage)}function ve(R){const G=R.target;G.removeEventListener("dispose",ve),Fe(G)}function Fe(R){Ne(R),Be.remove(R)}function Ne(R){const G=Be.get(R).programs;G!==void 0&&(G.forEach(function(K){Te.releaseProgram(K)}),R.isShaderMaterial&&Te.releaseShaderCache(R))}this.renderBufferDirect=function(R,G,K,te,j,Le){G===null&&(G=Ue);const ze=j.isMesh&&j.matrixWorld.determinant()<0,We=Ql(R,G,K,te,j);De.setMaterial(te,ze);let Xe=K.index,et=1;if(te.wireframe===!0){if(Xe=le.getWireframeAttribute(K),Xe===void 0)return;et=2}const Ze=K.drawRange,Je=K.attributes.position;let xt=Ze.start*et,kt=(Ze.start+Ze.count)*et;Le!==null&&(xt=Math.max(xt,Le.start*et),kt=Math.min(kt,(Le.start+Le.count)*et)),Xe!==null?(xt=Math.max(xt,0),kt=Math.min(kt,Xe.count)):Je!=null&&(xt=Math.max(xt,0),kt=Math.min(kt,Je.count));const Tt=kt-xt;if(Tt<0||Tt===1/0)return;C.setup(j,te,We,K,Xe);let fn,_t=me;if(Xe!==null&&(fn=ae.get(Xe),_t=Ae,_t.setIndex(fn)),j.isMesh)te.wireframe===!0?(De.setLineWidth(te.wireframeLinewidth*He()),_t.setMode(W.LINES)):_t.setMode(W.TRIANGLES);else if(j.isLine){let tt=te.linewidth;tt===void 0&&(tt=1),De.setLineWidth(tt*He()),j.isLineSegments?_t.setMode(W.LINES):j.isLineLoop?_t.setMode(W.LINE_LOOP):_t.setMode(W.LINE_STRIP)}else j.isPoints?_t.setMode(W.POINTS):j.isSprite&&_t.setMode(W.TRIANGLES);if(j.isBatchedMesh)_t.renderMultiDraw(j._multiDrawStarts,j._multiDrawCounts,j._multiDrawCount);else if(j.isInstancedMesh)_t.renderInstances(xt,Tt,j.count);else if(K.isInstancedBufferGeometry){const tt=K._maxInstanceCount!==void 0?K._maxInstanceCount:1/0,Zs=Math.min(K.instanceCount,tt);_t.renderInstances(xt,Tt,Zs)}else _t.render(xt,Tt)};function Ke(R,G,K){R.transparent===!0&&R.side===cn&&R.forceSinglePass===!1?(R.side=Ht,R.needsUpdate=!0,is(R,G,K),R.side=Bn,R.needsUpdate=!0,is(R,G,K),R.side=cn):is(R,G,K)}this.compile=function(R,G,K=null){K===null&&(K=R),p=Ie.get(K),p.init(),M.push(p),K.traverseVisible(function(j){j.isLight&&j.layers.test(G.layers)&&(p.pushLight(j),j.castShadow&&p.pushShadow(j))}),R!==K&&R.traverseVisible(function(j){j.isLight&&j.layers.test(G.layers)&&(p.pushLight(j),j.castShadow&&p.pushShadow(j))}),p.setupLights(v._useLegacyLights);const te=new Set;return R.traverse(function(j){const Le=j.material;if(Le)if(Array.isArray(Le))for(let ze=0;ze<Le.length;ze++){const We=Le[ze];Ke(We,K,j),te.add(We)}else Ke(Le,K,j),te.add(Le)}),M.pop(),p=null,te},this.compileAsync=function(R,G,K=null){const te=this.compile(R,G,K);return new Promise(j=>{function Le(){if(te.forEach(function(ze){Be.get(ze).currentProgram.isReady()&&te.delete(ze)}),te.size===0){j(R);return}setTimeout(Le,10)}we.get("KHR_parallel_shader_compile")!==null?Le():setTimeout(Le,10)})};let Ve=null;function ot(R){Ve&&Ve(R)}function ft(){mt.stop()}function st(){mt.start()}const mt=new Hl;mt.setAnimationLoop(ot),typeof self<"u"&&mt.setContext(self),this.setAnimationLoop=function(R){Ve=R,be.setAnimationLoop(R),R===null?mt.stop():mt.start()},be.addEventListener("sessionstart",ft),be.addEventListener("sessionend",st),this.render=function(R,G){if(G!==void 0&&G.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(E===!0)return;R.matrixWorldAutoUpdate===!0&&R.updateMatrixWorld(),G.parent===null&&G.matrixWorldAutoUpdate===!0&&G.updateMatrixWorld(),be.enabled===!0&&be.isPresenting===!0&&(be.cameraAutoUpdate===!0&&be.updateCamera(G),G=be.getCamera()),R.isScene===!0&&R.onBeforeRender(v,R,G,y),p=Ie.get(R,M.length),p.init(),M.push(p),ue.multiplyMatrices(G.projectionMatrix,G.matrixWorldInverse),Y.setFromProjectionMatrix(ue),pe=this.localClippingEnabled,ee=Ge.init(this.clippingPlanes,pe),g=ge.get(R,d.length),g.init(),d.push(g),Ut(R,G,0,v.sortObjects),g.finish(),v.sortObjects===!0&&g.sort(X,V),this.info.render.frame++,ee===!0&&Ge.beginShadows();const K=p.state.shadowsArray;if(ie.render(K,R,G),ee===!0&&Ge.endShadows(),this.info.autoReset===!0&&this.info.reset(),ke.render(g,R),p.setupLights(v._useLegacyLights),G.isArrayCamera){const te=G.cameras;for(let j=0,Le=te.length;j<Le;j++){const ze=te[j];Bi(g,R,ze,ze.viewport)}}else Bi(g,R,G);y!==null&&(A.updateMultisampleRenderTarget(y),A.updateRenderTargetMipmap(y)),R.isScene===!0&&R.onAfterRender(v,R,G),C.resetDefaultState(),L=-1,x=null,M.pop(),M.length>0?p=M[M.length-1]:p=null,d.pop(),d.length>0?g=d[d.length-1]:g=null};function Ut(R,G,K,te){if(R.visible===!1)return;if(R.layers.test(G.layers)){if(R.isGroup)K=R.renderOrder;else if(R.isLOD)R.autoUpdate===!0&&R.update(G);else if(R.isLight)p.pushLight(R),R.castShadow&&p.pushShadow(R);else if(R.isSprite){if(!R.frustumCulled||Y.intersectsSprite(R)){te&&Oe.setFromMatrixPosition(R.matrixWorld).applyMatrix4(ue);const ze=ce.update(R),We=R.material;We.visible&&g.push(R,ze,We,K,Oe.z,null)}}else if((R.isMesh||R.isLine||R.isPoints)&&(!R.frustumCulled||Y.intersectsObject(R))){const ze=ce.update(R),We=R.material;if(te&&(R.boundingSphere!==void 0?(R.boundingSphere===null&&R.computeBoundingSphere(),Oe.copy(R.boundingSphere.center)):(ze.boundingSphere===null&&ze.computeBoundingSphere(),Oe.copy(ze.boundingSphere.center)),Oe.applyMatrix4(R.matrixWorld).applyMatrix4(ue)),Array.isArray(We)){const Xe=ze.groups;for(let et=0,Ze=Xe.length;et<Ze;et++){const Je=Xe[et],xt=We[Je.materialIndex];xt&&xt.visible&&g.push(R,ze,xt,K,Oe.z,Je)}}else We.visible&&g.push(R,ze,We,K,Oe.z,null)}}const Le=R.children;for(let ze=0,We=Le.length;ze<We;ze++)Ut(Le[ze],G,K,te)}function Bi(R,G,K,te){const j=R.opaque,Le=R.transmissive,ze=R.transparent;p.setupLightsView(K),ee===!0&&Ge.setGlobalState(v.clippingPlanes,K),Le.length>0&&Jl(j,Le,G,K),te&&De.viewport(b.copy(te)),j.length>0&&ns(j,G,K),Le.length>0&&ns(Le,G,K),ze.length>0&&ns(ze,G,K),De.buffers.depth.setTest(!0),De.buffers.depth.setMask(!0),De.buffers.color.setMask(!0),De.setPolygonOffset(!1)}function Jl(R,G,K,te){if((K.isScene===!0?K.overrideMaterial:null)!==null)return;const Le=Re.isWebGL2;oe===null&&(oe=new ti(1,1,{generateMipmaps:!0,type:we.has("EXT_color_buffer_half_float")?$i:On,minFilter:Qi,samples:Le?4:0})),v.getDrawingBufferSize(Pe),Le?oe.setSize(Pe.x,Pe.y):oe.setSize(Kr(Pe.x),Kr(Pe.y));const ze=v.getRenderTarget();v.setRenderTarget(oe),v.getClearColor($),P=v.getClearAlpha(),P<1&&v.setClearColor(16777215,.5),v.clear();const We=v.toneMapping;v.toneMapping=Fn,ns(R,K,te),A.updateMultisampleRenderTarget(oe),A.updateRenderTargetMipmap(oe);let Xe=!1;for(let et=0,Ze=G.length;et<Ze;et++){const Je=G[et],xt=Je.object,kt=Je.geometry,Tt=Je.material,fn=Je.group;if(Tt.side===cn&&xt.layers.test(te.layers)){const _t=Tt.side;Tt.side=Ht,Tt.needsUpdate=!0,ca(xt,K,te,kt,Tt,fn),Tt.side=_t,Tt.needsUpdate=!0,Xe=!0}}Xe===!0&&(A.updateMultisampleRenderTarget(oe),A.updateRenderTargetMipmap(oe)),v.setRenderTarget(ze),v.setClearColor($,P),v.toneMapping=We}function ns(R,G,K){const te=G.isScene===!0?G.overrideMaterial:null;for(let j=0,Le=R.length;j<Le;j++){const ze=R[j],We=ze.object,Xe=ze.geometry,et=te===null?ze.material:te,Ze=ze.group;We.layers.test(K.layers)&&ca(We,G,K,Xe,et,Ze)}}function ca(R,G,K,te,j,Le){R.onBeforeRender(v,G,K,te,j,Le),R.modelViewMatrix.multiplyMatrices(K.matrixWorldInverse,R.matrixWorld),R.normalMatrix.getNormalMatrix(R.modelViewMatrix),j.onBeforeRender(v,G,K,te,R,Le),j.transparent===!0&&j.side===cn&&j.forceSinglePass===!1?(j.side=Ht,j.needsUpdate=!0,v.renderBufferDirect(K,G,te,j,R,Le),j.side=Bn,j.needsUpdate=!0,v.renderBufferDirect(K,G,te,j,R,Le),j.side=cn):v.renderBufferDirect(K,G,te,j,R,Le),R.onAfterRender(v,G,K,te,j,Le)}function is(R,G,K){G.isScene!==!0&&(G=Ue);const te=Be.get(R),j=p.state.lights,Le=p.state.shadowsArray,ze=j.state.version,We=Te.getParameters(R,j.state,Le,G,K),Xe=Te.getProgramCacheKey(We);let et=te.programs;te.environment=R.isMeshStandardMaterial?G.environment:null,te.fog=G.fog,te.envMap=(R.isMeshStandardMaterial?q:S).get(R.envMap||te.environment),et===void 0&&(R.addEventListener("dispose",ve),et=new Map,te.programs=et);let Ze=et.get(Xe);if(Ze!==void 0){if(te.currentProgram===Ze&&te.lightsStateVersion===ze)return ha(R,We),Ze}else We.uniforms=Te.getUniforms(R),R.onBuild(K,We,v),R.onBeforeCompile(We,v),Ze=Te.acquireProgram(We,Xe),et.set(Xe,Ze),te.uniforms=We.uniforms;const Je=te.uniforms;return(!R.isShaderMaterial&&!R.isRawShaderMaterial||R.clipping===!0)&&(Je.clippingPlanes=Ge.uniform),ha(R,We),te.needsLights=ec(R),te.lightsStateVersion=ze,te.needsLights&&(Je.ambientLightColor.value=j.state.ambient,Je.lightProbe.value=j.state.probe,Je.directionalLights.value=j.state.directional,Je.directionalLightShadows.value=j.state.directionalShadow,Je.spotLights.value=j.state.spot,Je.spotLightShadows.value=j.state.spotShadow,Je.rectAreaLights.value=j.state.rectArea,Je.ltc_1.value=j.state.rectAreaLTC1,Je.ltc_2.value=j.state.rectAreaLTC2,Je.pointLights.value=j.state.point,Je.pointLightShadows.value=j.state.pointShadow,Je.hemisphereLights.value=j.state.hemi,Je.directionalShadowMap.value=j.state.directionalShadowMap,Je.directionalShadowMatrix.value=j.state.directionalShadowMatrix,Je.spotShadowMap.value=j.state.spotShadowMap,Je.spotLightMatrix.value=j.state.spotLightMatrix,Je.spotLightMap.value=j.state.spotLightMap,Je.pointShadowMap.value=j.state.pointShadowMap,Je.pointShadowMatrix.value=j.state.pointShadowMatrix),te.currentProgram=Ze,te.uniformsList=null,Ze}function ua(R){if(R.uniformsList===null){const G=R.currentProgram.getUniforms();R.uniformsList=Ls.seqWithValue(G.seq,R.uniforms)}return R.uniformsList}function ha(R,G){const K=Be.get(R);K.outputColorSpace=G.outputColorSpace,K.batching=G.batching,K.instancing=G.instancing,K.instancingColor=G.instancingColor,K.skinning=G.skinning,K.morphTargets=G.morphTargets,K.morphNormals=G.morphNormals,K.morphColors=G.morphColors,K.morphTargetsCount=G.morphTargetsCount,K.numClippingPlanes=G.numClippingPlanes,K.numIntersection=G.numClipIntersection,K.vertexAlphas=G.vertexAlphas,K.vertexTangents=G.vertexTangents,K.toneMapping=G.toneMapping}function Ql(R,G,K,te,j){G.isScene!==!0&&(G=Ue),A.resetTextureUnits();const Le=G.fog,ze=te.isMeshStandardMaterial?G.environment:null,We=y===null?v.outputColorSpace:y.isXRRenderTarget===!0?y.texture.colorSpace:Sn,Xe=(te.isMeshStandardMaterial?q:S).get(te.envMap||ze),et=te.vertexColors===!0&&!!K.attributes.color&&K.attributes.color.itemSize===4,Ze=!!K.attributes.tangent&&(!!te.normalMap||te.anisotropy>0),Je=!!K.morphAttributes.position,xt=!!K.morphAttributes.normal,kt=!!K.morphAttributes.color;let Tt=Fn;te.toneMapped&&(y===null||y.isXRRenderTarget===!0)&&(Tt=v.toneMapping);const fn=K.morphAttributes.position||K.morphAttributes.normal||K.morphAttributes.color,_t=fn!==void 0?fn.length:0,tt=Be.get(te),Zs=p.state.lights;if(ee===!0&&(pe===!0||R!==x)){const qt=R===x&&te.id===L;Ge.setState(te,R,qt)}let vt=!1;te.version===tt.__version?(tt.needsLights&&tt.lightsStateVersion!==Zs.state.version||tt.outputColorSpace!==We||j.isBatchedMesh&&tt.batching===!1||!j.isBatchedMesh&&tt.batching===!0||j.isInstancedMesh&&tt.instancing===!1||!j.isInstancedMesh&&tt.instancing===!0||j.isSkinnedMesh&&tt.skinning===!1||!j.isSkinnedMesh&&tt.skinning===!0||j.isInstancedMesh&&tt.instancingColor===!0&&j.instanceColor===null||j.isInstancedMesh&&tt.instancingColor===!1&&j.instanceColor!==null||tt.envMap!==Xe||te.fog===!0&&tt.fog!==Le||tt.numClippingPlanes!==void 0&&(tt.numClippingPlanes!==Ge.numPlanes||tt.numIntersection!==Ge.numIntersection)||tt.vertexAlphas!==et||tt.vertexTangents!==Ze||tt.morphTargets!==Je||tt.morphNormals!==xt||tt.morphColors!==kt||tt.toneMapping!==Tt||Re.isWebGL2===!0&&tt.morphTargetsCount!==_t)&&(vt=!0):(vt=!0,tt.__version=te.version);let Gn=tt.currentProgram;vt===!0&&(Gn=is(te,G,j));let fa=!1,zi=!1,Js=!1;const Ct=Gn.getUniforms(),Vn=tt.uniforms;if(De.useProgram(Gn.program)&&(fa=!0,zi=!0,Js=!0),te.id!==L&&(L=te.id,zi=!0),fa||x!==R){Ct.setValue(W,"projectionMatrix",R.projectionMatrix),Ct.setValue(W,"viewMatrix",R.matrixWorldInverse);const qt=Ct.map.cameraPosition;qt!==void 0&&qt.setValue(W,Oe.setFromMatrixPosition(R.matrixWorld)),Re.logarithmicDepthBuffer&&Ct.setValue(W,"logDepthBufFC",2/(Math.log(R.far+1)/Math.LN2)),(te.isMeshPhongMaterial||te.isMeshToonMaterial||te.isMeshLambertMaterial||te.isMeshBasicMaterial||te.isMeshStandardMaterial||te.isShaderMaterial)&&Ct.setValue(W,"isOrthographic",R.isOrthographicCamera===!0),x!==R&&(x=R,zi=!0,Js=!0)}if(j.isSkinnedMesh){Ct.setOptional(W,j,"bindMatrix"),Ct.setOptional(W,j,"bindMatrixInverse");const qt=j.skeleton;qt&&(Re.floatVertexTextures?(qt.boneTexture===null&&qt.computeBoneTexture(),Ct.setValue(W,"boneTexture",qt.boneTexture,A)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}j.isBatchedMesh&&(Ct.setOptional(W,j,"batchingTexture"),Ct.setValue(W,"batchingTexture",j._matricesTexture,A));const Qs=K.morphAttributes;if((Qs.position!==void 0||Qs.normal!==void 0||Qs.color!==void 0&&Re.isWebGL2===!0)&&se.update(j,K,Gn),(zi||tt.receiveShadow!==j.receiveShadow)&&(tt.receiveShadow=j.receiveShadow,Ct.setValue(W,"receiveShadow",j.receiveShadow)),te.isMeshGouraudMaterial&&te.envMap!==null&&(Vn.envMap.value=Xe,Vn.flipEnvMap.value=Xe.isCubeTexture&&Xe.isRenderTargetTexture===!1?-1:1),zi&&(Ct.setValue(W,"toneMappingExposure",v.toneMappingExposure),tt.needsLights&&$l(Vn,Js),Le&&te.fog===!0&&xe.refreshFogUniforms(Vn,Le),xe.refreshMaterialUniforms(Vn,te,k,B,oe),Ls.upload(W,ua(tt),Vn,A)),te.isShaderMaterial&&te.uniformsNeedUpdate===!0&&(Ls.upload(W,ua(tt),Vn,A),te.uniformsNeedUpdate=!1),te.isSpriteMaterial&&Ct.setValue(W,"center",j.center),Ct.setValue(W,"modelViewMatrix",j.modelViewMatrix),Ct.setValue(W,"normalMatrix",j.normalMatrix),Ct.setValue(W,"modelMatrix",j.matrixWorld),te.isShaderMaterial||te.isRawShaderMaterial){const qt=te.uniformsGroups;for(let $s=0,tc=qt.length;$s<tc;$s++)if(Re.isWebGL2){const da=qt[$s];he.update(da,Gn),he.bind(da,Gn)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return Gn}function $l(R,G){R.ambientLightColor.needsUpdate=G,R.lightProbe.needsUpdate=G,R.directionalLights.needsUpdate=G,R.directionalLightShadows.needsUpdate=G,R.pointLights.needsUpdate=G,R.pointLightShadows.needsUpdate=G,R.spotLights.needsUpdate=G,R.spotLightShadows.needsUpdate=G,R.rectAreaLights.needsUpdate=G,R.hemisphereLights.needsUpdate=G}function ec(R){return R.isMeshLambertMaterial||R.isMeshToonMaterial||R.isMeshPhongMaterial||R.isMeshStandardMaterial||R.isShadowMaterial||R.isShaderMaterial&&R.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return w},this.getRenderTarget=function(){return y},this.setRenderTargetTextures=function(R,G,K){Be.get(R.texture).__webglTexture=G,Be.get(R.depthTexture).__webglTexture=K;const te=Be.get(R);te.__hasExternalTextures=!0,te.__hasExternalTextures&&(te.__autoAllocateDepthBuffer=K===void 0,te.__autoAllocateDepthBuffer||we.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),te.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(R,G){const K=Be.get(R);K.__webglFramebuffer=G,K.__useDefaultFramebuffer=G===void 0},this.setRenderTarget=function(R,G=0,K=0){y=R,T=G,w=K;let te=!0,j=null,Le=!1,ze=!1;if(R){const Xe=Be.get(R);Xe.__useDefaultFramebuffer!==void 0?(De.bindFramebuffer(W.FRAMEBUFFER,null),te=!1):Xe.__webglFramebuffer===void 0?A.setupRenderTarget(R):Xe.__hasExternalTextures&&A.rebindTextures(R,Be.get(R.texture).__webglTexture,Be.get(R.depthTexture).__webglTexture);const et=R.texture;(et.isData3DTexture||et.isDataArrayTexture||et.isCompressedArrayTexture)&&(ze=!0);const Ze=Be.get(R).__webglFramebuffer;R.isWebGLCubeRenderTarget?(Array.isArray(Ze[G])?j=Ze[G][K]:j=Ze[G],Le=!0):Re.isWebGL2&&R.samples>0&&A.useMultisampledRTT(R)===!1?j=Be.get(R).__webglMultisampledFramebuffer:Array.isArray(Ze)?j=Ze[K]:j=Ze,b.copy(R.viewport),N.copy(R.scissor),O=R.scissorTest}else b.copy(z).multiplyScalar(k).floor(),N.copy(ne).multiplyScalar(k).floor(),O=_e;if(De.bindFramebuffer(W.FRAMEBUFFER,j)&&Re.drawBuffers&&te&&De.drawBuffers(R,j),De.viewport(b),De.scissor(N),De.setScissorTest(O),Le){const Xe=Be.get(R.texture);W.framebufferTexture2D(W.FRAMEBUFFER,W.COLOR_ATTACHMENT0,W.TEXTURE_CUBE_MAP_POSITIVE_X+G,Xe.__webglTexture,K)}else if(ze){const Xe=Be.get(R.texture),et=G||0;W.framebufferTextureLayer(W.FRAMEBUFFER,W.COLOR_ATTACHMENT0,Xe.__webglTexture,K||0,et)}L=-1},this.readRenderTargetPixels=function(R,G,K,te,j,Le,ze){if(!(R&&R.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let We=Be.get(R).__webglFramebuffer;if(R.isWebGLCubeRenderTarget&&ze!==void 0&&(We=We[ze]),We){De.bindFramebuffer(W.FRAMEBUFFER,We);try{const Xe=R.texture,et=Xe.format,Ze=Xe.type;if(et!==nn&&Se.convert(et)!==W.getParameter(W.IMPLEMENTATION_COLOR_READ_FORMAT)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}const Je=Ze===$i&&(we.has("EXT_color_buffer_half_float")||Re.isWebGL2&&we.has("EXT_color_buffer_float"));if(Ze!==On&&Se.convert(Ze)!==W.getParameter(W.IMPLEMENTATION_COLOR_READ_TYPE)&&!(Ze===Un&&(Re.isWebGL2||we.has("OES_texture_float")||we.has("WEBGL_color_buffer_float")))&&!Je){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}G>=0&&G<=R.width-te&&K>=0&&K<=R.height-j&&W.readPixels(G,K,te,j,Se.convert(et),Se.convert(Ze),Le)}finally{const Xe=y!==null?Be.get(y).__webglFramebuffer:null;De.bindFramebuffer(W.FRAMEBUFFER,Xe)}}},this.copyFramebufferToTexture=function(R,G,K=0){const te=Math.pow(2,-K),j=Math.floor(G.image.width*te),Le=Math.floor(G.image.height*te);A.setTexture2D(G,0),W.copyTexSubImage2D(W.TEXTURE_2D,K,0,0,R.x,R.y,j,Le),De.unbindTexture()},this.copyTextureToTexture=function(R,G,K,te=0){const j=G.image.width,Le=G.image.height,ze=Se.convert(K.format),We=Se.convert(K.type);A.setTexture2D(K,0),W.pixelStorei(W.UNPACK_FLIP_Y_WEBGL,K.flipY),W.pixelStorei(W.UNPACK_PREMULTIPLY_ALPHA_WEBGL,K.premultiplyAlpha),W.pixelStorei(W.UNPACK_ALIGNMENT,K.unpackAlignment),G.isDataTexture?W.texSubImage2D(W.TEXTURE_2D,te,R.x,R.y,j,Le,ze,We,G.image.data):G.isCompressedTexture?W.compressedTexSubImage2D(W.TEXTURE_2D,te,R.x,R.y,G.mipmaps[0].width,G.mipmaps[0].height,ze,G.mipmaps[0].data):W.texSubImage2D(W.TEXTURE_2D,te,R.x,R.y,ze,We,G.image),te===0&&K.generateMipmaps&&W.generateMipmap(W.TEXTURE_2D),De.unbindTexture()},this.copyTextureToTexture3D=function(R,G,K,te,j=0){if(v.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}const Le=R.max.x-R.min.x+1,ze=R.max.y-R.min.y+1,We=R.max.z-R.min.z+1,Xe=Se.convert(te.format),et=Se.convert(te.type);let Ze;if(te.isData3DTexture)A.setTexture3D(te,0),Ze=W.TEXTURE_3D;else if(te.isDataArrayTexture||te.isCompressedArrayTexture)A.setTexture2DArray(te,0),Ze=W.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}W.pixelStorei(W.UNPACK_FLIP_Y_WEBGL,te.flipY),W.pixelStorei(W.UNPACK_PREMULTIPLY_ALPHA_WEBGL,te.premultiplyAlpha),W.pixelStorei(W.UNPACK_ALIGNMENT,te.unpackAlignment);const Je=W.getParameter(W.UNPACK_ROW_LENGTH),xt=W.getParameter(W.UNPACK_IMAGE_HEIGHT),kt=W.getParameter(W.UNPACK_SKIP_PIXELS),Tt=W.getParameter(W.UNPACK_SKIP_ROWS),fn=W.getParameter(W.UNPACK_SKIP_IMAGES),_t=K.isCompressedTexture?K.mipmaps[j]:K.image;W.pixelStorei(W.UNPACK_ROW_LENGTH,_t.width),W.pixelStorei(W.UNPACK_IMAGE_HEIGHT,_t.height),W.pixelStorei(W.UNPACK_SKIP_PIXELS,R.min.x),W.pixelStorei(W.UNPACK_SKIP_ROWS,R.min.y),W.pixelStorei(W.UNPACK_SKIP_IMAGES,R.min.z),K.isDataTexture||K.isData3DTexture?W.texSubImage3D(Ze,j,G.x,G.y,G.z,Le,ze,We,Xe,et,_t.data):K.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),W.compressedTexSubImage3D(Ze,j,G.x,G.y,G.z,Le,ze,We,Xe,_t.data)):W.texSubImage3D(Ze,j,G.x,G.y,G.z,Le,ze,We,Xe,et,_t),W.pixelStorei(W.UNPACK_ROW_LENGTH,Je),W.pixelStorei(W.UNPACK_IMAGE_HEIGHT,xt),W.pixelStorei(W.UNPACK_SKIP_PIXELS,kt),W.pixelStorei(W.UNPACK_SKIP_ROWS,Tt),W.pixelStorei(W.UNPACK_SKIP_IMAGES,fn),j===0&&te.generateMipmaps&&W.generateMipmap(Ze),De.unbindTexture()},this.initTexture=function(R){R.isCubeTexture?A.setTextureCube(R,0):R.isData3DTexture?A.setTexture3D(R,0):R.isDataArrayTexture||R.isCompressedArrayTexture?A.setTexture2DArray(R,0):A.setTexture2D(R,0),De.unbindTexture()},this.resetState=function(){T=0,w=0,y=null,De.reset(),C.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Mn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=e===ia?"display-p3":"srgb",t.unpackColorSpace=ut.workingColorSpace===qs?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===wt?ei:Tl}set outputEncoding(e){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=e===ei?wt:Sn}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(e){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=e}}class fm extends jl{}fm.prototype.isWebGL1Renderer=!0;class dm extends Rt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t}}class Hs extends Fi{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new it(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const No=new F,Fo=new F,Oo=new Mt,Pr=new sa,As=new Ys;class pm extends Rt{constructor(e=new sn,t=new Hs){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let s=1,r=t.count;s<r;s++)No.fromBufferAttribute(t,s-1),Fo.fromBufferAttribute(t,s),n[s]=n[s-1],n[s]+=No.distanceTo(Fo);e.setAttribute("lineDistance",new Bt(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),As.copy(n.boundingSphere),As.applyMatrix4(s),As.radius+=r,e.ray.intersectsSphere(As)===!1)return;Oo.copy(s).invert(),Pr.copy(e.ray).applyMatrix4(Oo);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=new F,u=new F,h=new F,f=new F,m=this.isLineSegments?2:1,_=n.index,p=n.attributes.position;if(_!==null){const d=Math.max(0,a.start),M=Math.min(_.count,a.start+a.count);for(let v=d,E=M-1;v<E;v+=m){const T=_.getX(v),w=_.getX(v+1);if(c.fromBufferAttribute(p,T),u.fromBufferAttribute(p,w),Pr.distanceSqToSegment(c,u,f,h)>l)continue;f.applyMatrix4(this.matrixWorld);const L=e.ray.origin.distanceTo(f);L<e.near||L>e.far||t.push({distance:L,point:h.clone().applyMatrix4(this.matrixWorld),index:v,face:null,faceIndex:null,object:this})}}else{const d=Math.max(0,a.start),M=Math.min(p.count,a.start+a.count);for(let v=d,E=M-1;v<E;v+=m){if(c.fromBufferAttribute(p,v),u.fromBufferAttribute(p,v+1),Pr.distanceSqToSegment(c,u,f,h)>l)continue;f.applyMatrix4(this.matrixWorld);const w=e.ray.origin.distanceTo(f);w<e.near||w>e.far||t.push({distance:w,point:h.clone().applyMatrix4(this.matrixWorld),index:v,face:null,faceIndex:null,object:this})}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}const Bo=new F,zo=new F;class Jr extends pm{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let s=0,r=t.count;s<r;s+=2)Bo.fromBufferAttribute(t,s),zo.fromBufferAttribute(t,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+Bo.distanceTo(zo);e.setAttribute("lineDistance",new Bt(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class ks extends sn{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const u=[],h=[],f=[],m=[];let _=0;const g=[],p=n/2;let d=0;M(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(u),this.setAttribute("position",new Bt(h,3)),this.setAttribute("normal",new Bt(f,3)),this.setAttribute("uv",new Bt(m,2));function M(){const E=new F,T=new F;let w=0;const y=(t-e)/n;for(let L=0;L<=r;L++){const x=[],b=L/r,N=b*(t-e)+e;for(let O=0;O<=s;O++){const $=O/s,P=$*l+o,U=Math.sin(P),B=Math.cos(P);T.x=N*U,T.y=-b*n+p,T.z=N*B,h.push(T.x,T.y,T.z),E.set(U,y,B).normalize(),f.push(E.x,E.y,E.z),m.push($,1-b),x.push(_++)}g.push(x)}for(let L=0;L<s;L++)for(let x=0;x<r;x++){const b=g[x][L],N=g[x+1][L],O=g[x+1][L+1],$=g[x][L+1];u.push(b,N,$),u.push(N,O,$),w+=6}c.addGroup(d,w,0),d+=w}function v(E){const T=_,w=new qe,y=new F;let L=0;const x=E===!0?e:t,b=E===!0?1:-1;for(let O=1;O<=s;O++)h.push(0,p*b,0),f.push(0,b,0),m.push(.5,.5),_++;const N=_;for(let O=0;O<=s;O++){const P=O/s*l+o,U=Math.cos(P),B=Math.sin(P);y.x=x*B,y.y=p*b,y.z=x*U,h.push(y.x,y.y,y.z),f.push(0,b,0),w.x=U*.5+.5,w.y=B*.5*b+.5,m.push(w.x,w.y),_++}for(let O=0;O<s;O++){const $=T+O,P=N+O;E===!0?u.push(P,P+1,$):u.push(P+1,P,$),L+=3}c.addGroup(d,L,E===!0?1:2),d+=L}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ks(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}const ws=new F,Rs=new F,Lr=new F,Cs=new Kt;class Ho extends sn{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){const s=Math.pow(10,4),r=Math.cos(qi*t),a=e.getIndex(),o=e.getAttribute("position"),l=a?a.count:o.count,c=[0,0,0],u=["a","b","c"],h=new Array(3),f={},m=[];for(let _=0;_<l;_+=3){a?(c[0]=a.getX(_),c[1]=a.getX(_+1),c[2]=a.getX(_+2)):(c[0]=_,c[1]=_+1,c[2]=_+2);const{a:g,b:p,c:d}=Cs;if(g.fromBufferAttribute(o,c[0]),p.fromBufferAttribute(o,c[1]),d.fromBufferAttribute(o,c[2]),Cs.getNormal(Lr),h[0]=`${Math.round(g.x*s)},${Math.round(g.y*s)},${Math.round(g.z*s)}`,h[1]=`${Math.round(p.x*s)},${Math.round(p.y*s)},${Math.round(p.z*s)}`,h[2]=`${Math.round(d.x*s)},${Math.round(d.y*s)},${Math.round(d.z*s)}`,!(h[0]===h[1]||h[1]===h[2]||h[2]===h[0]))for(let M=0;M<3;M++){const v=(M+1)%3,E=h[M],T=h[v],w=Cs[u[M]],y=Cs[u[v]],L=`${E}_${T}`,x=`${T}_${E}`;x in f&&f[x]?(Lr.dot(f[x].normal)<=r&&(m.push(w.x,w.y,w.z),m.push(y.x,y.y,y.z)),f[x]=null):L in f||(f[L]={index0:c[M],index1:c[v],normal:Lr.clone()})}}for(const _ in f)if(f[_]){const{index0:g,index1:p}=f[_];ws.fromBufferAttribute(o,g),Rs.fromBufferAttribute(o,p),m.push(ws.x,ws.y,ws.z),m.push(Rs.x,Rs.y,Rs.z)}this.setAttribute("position",new Bt(m,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}}class Qr extends Fi{constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new it(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new it(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Al,this.normalScale=new qe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class ko extends Qr{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new qe(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Dt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new it(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new it(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new it(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class la extends Rt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new it(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}}const Dr=new Mt,Go=new F,Vo=new F;class Kl{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new qe(512,512),this.map=null,this.mapPass=null,this.matrix=new Mt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ra,this._frameExtents=new qe(1,1),this._viewportCount=1,this._viewports=[new pt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;Go.setFromMatrixPosition(e.matrixWorld),t.position.copy(Go),Vo.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Vo),t.updateMatrixWorld(),Dr.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Dr),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Dr)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const Wo=new Mt,Xi=new F,Ir=new F;class mm extends Kl{constructor(){super(new Wt(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new qe(4,2),this._viewportCount=6,this._viewports=[new pt(2,1,1,1),new pt(0,1,1,1),new pt(3,1,1,1),new pt(1,1,1,1),new pt(3,0,1,1),new pt(1,0,1,1)],this._cubeDirections=[new F(1,0,0),new F(-1,0,0),new F(0,0,1),new F(0,0,-1),new F(0,1,0),new F(0,-1,0)],this._cubeUps=[new F(0,1,0),new F(0,1,0),new F(0,1,0),new F(0,1,0),new F(0,0,1),new F(0,0,-1)]}updateMatrices(e,t=0){const n=this.camera,s=this.matrix,r=e.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),Xi.setFromMatrixPosition(e.matrixWorld),n.position.copy(Xi),Ir.copy(n.position),Ir.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(Ir),n.updateMatrixWorld(),s.makeTranslation(-Xi.x,-Xi.y,-Xi.z),Wo.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Wo)}}class _m extends la{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new mm}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class gm extends Kl{constructor(){super(new kl(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Xo extends la{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.target=new Rt,this.shadow=new gm}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class vm extends la{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class qo{constructor(e=1,t=0,n=0){return this.radius=e,this.phi=t,this.theta=n,this}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(Dt(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class xm extends Jr{constructor(e=10,t=10,n=4473924,s=8947848){n=new it(n),s=new it(s);const r=t/2,a=e/t,o=e/2,l=[],c=[];for(let f=0,m=0,_=-o;f<=t;f++,_+=a){l.push(-o,0,_,o,0,_),l.push(_,0,-o,_,0,o);const g=f===r?n:s;g.toArray(c,m),m+=3,g.toArray(c,m),m+=3,g.toArray(c,m),m+=3,g.toArray(c,m),m+=3}const u=new sn;u.setAttribute("position",new Bt(l,3)),u.setAttribute("color",new Bt(c,3));const h=new Hs({vertexColors:!0,toneMapped:!1});super(u,h),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:ta}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=ta);const Yo={type:"change"},Ur={type:"start"},jo={type:"end"},Ps=new sa,Ko=new Rn,Mm=Math.cos(70*ru.DEG2RAD);class Sm extends ri{constructor(e,t){super(),this.object=e,this.domElement=t,this.domElement.style.touchAction="none",this.enabled=!0,this.target=new F,this.cursor=new F,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:oi.ROTATE,MIDDLE:oi.DOLLY,RIGHT:oi.PAN},this.touches={ONE:li.ROTATE,TWO:li.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this.getPolarAngle=function(){return o.phi},this.getAzimuthalAngle=function(){return o.theta},this.getDistance=function(){return this.object.position.distanceTo(this.target)},this.listenToKeyEvents=function(C){C.addEventListener("keydown",Ie),this._domElementKeyEvents=C},this.stopListenToKeyEvents=function(){this._domElementKeyEvents.removeEventListener("keydown",Ie),this._domElementKeyEvents=null},this.saveState=function(){n.target0.copy(n.target),n.position0.copy(n.object.position),n.zoom0=n.object.zoom},this.reset=function(){n.target.copy(n.target0),n.object.position.copy(n.position0),n.object.zoom=n.zoom0,n.object.updateProjectionMatrix(),n.dispatchEvent(Yo),n.update(),r=s.NONE},this.update=function(){const C=new F,he=new ni().setFromUnitVectors(e.up,new F(0,1,0)),Ce=he.clone().invert(),be=new F,re=new ni,I=new F,de=2*Math.PI;return function(Fe=null){const Ne=n.object.position;C.copy(Ne).sub(n.target),C.applyQuaternion(he),o.setFromVector3(C),n.autoRotate&&r===s.NONE&&O(b(Fe)),n.enableDamping?(o.theta+=l.theta*n.dampingFactor,o.phi+=l.phi*n.dampingFactor):(o.theta+=l.theta,o.phi+=l.phi);let Ke=n.minAzimuthAngle,Ve=n.maxAzimuthAngle;isFinite(Ke)&&isFinite(Ve)&&(Ke<-Math.PI?Ke+=de:Ke>Math.PI&&(Ke-=de),Ve<-Math.PI?Ve+=de:Ve>Math.PI&&(Ve-=de),Ke<=Ve?o.theta=Math.max(Ke,Math.min(Ve,o.theta)):o.theta=o.theta>(Ke+Ve)/2?Math.max(Ke,o.theta):Math.min(Ve,o.theta)),o.phi=Math.max(n.minPolarAngle,Math.min(n.maxPolarAngle,o.phi)),o.makeSafe(),n.enableDamping===!0?n.target.addScaledVector(u,n.dampingFactor):n.target.add(u),n.target.sub(n.cursor),n.target.clampLength(n.minTargetRadius,n.maxTargetRadius),n.target.add(n.cursor),n.zoomToCursor&&w||n.object.isOrthographicCamera?o.radius=z(o.radius):o.radius=z(o.radius*c),C.setFromSpherical(o),C.applyQuaternion(Ce),Ne.copy(n.target).add(C),n.object.lookAt(n.target),n.enableDamping===!0?(l.theta*=1-n.dampingFactor,l.phi*=1-n.dampingFactor,u.multiplyScalar(1-n.dampingFactor)):(l.set(0,0,0),u.set(0,0,0));let ot=!1;if(n.zoomToCursor&&w){let ft=null;if(n.object.isPerspectiveCamera){const st=C.length();ft=z(st*c);const mt=st-ft;n.object.position.addScaledVector(E,mt),n.object.updateMatrixWorld()}else if(n.object.isOrthographicCamera){const st=new F(T.x,T.y,0);st.unproject(n.object),n.object.zoom=Math.max(n.minZoom,Math.min(n.maxZoom,n.object.zoom/c)),n.object.updateProjectionMatrix(),ot=!0;const mt=new F(T.x,T.y,0);mt.unproject(n.object),n.object.position.sub(mt).add(st),n.object.updateMatrixWorld(),ft=C.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),n.zoomToCursor=!1;ft!==null&&(this.screenSpacePanning?n.target.set(0,0,-1).transformDirection(n.object.matrix).multiplyScalar(ft).add(n.object.position):(Ps.origin.copy(n.object.position),Ps.direction.set(0,0,-1).transformDirection(n.object.matrix),Math.abs(n.object.up.dot(Ps.direction))<Mm?e.lookAt(n.target):(Ko.setFromNormalAndCoplanarPoint(n.object.up,n.target),Ps.intersectPlane(Ko,n.target))))}else n.object.isOrthographicCamera&&(n.object.zoom=Math.max(n.minZoom,Math.min(n.maxZoom,n.object.zoom/c)),n.object.updateProjectionMatrix(),ot=!0);return c=1,w=!1,ot||be.distanceToSquared(n.object.position)>a||8*(1-re.dot(n.object.quaternion))>a||I.distanceToSquared(n.target)>0?(n.dispatchEvent(Yo),be.copy(n.object.position),re.copy(n.object.quaternion),I.copy(n.target),!0):!1}}(),this.dispose=function(){n.domElement.removeEventListener("contextmenu",ke),n.domElement.removeEventListener("pointerdown",A),n.domElement.removeEventListener("pointercancel",q),n.domElement.removeEventListener("wheel",ce),n.domElement.removeEventListener("pointermove",S),n.domElement.removeEventListener("pointerup",q),n._domElementKeyEvents!==null&&(n._domElementKeyEvents.removeEventListener("keydown",Ie),n._domElementKeyEvents=null)};const n=this,s={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6};let r=s.NONE;const a=1e-6,o=new qo,l=new qo;let c=1;const u=new F,h=new qe,f=new qe,m=new qe,_=new qe,g=new qe,p=new qe,d=new qe,M=new qe,v=new qe,E=new F,T=new qe;let w=!1;const y=[],L={};let x=!1;function b(C){return C!==null?2*Math.PI/60*n.autoRotateSpeed*C:2*Math.PI/60/60*n.autoRotateSpeed}function N(C){const he=Math.abs(C*.01);return Math.pow(.95,n.zoomSpeed*he)}function O(C){l.theta-=C}function $(C){l.phi-=C}const P=function(){const C=new F;return function(Ce,be){C.setFromMatrixColumn(be,0),C.multiplyScalar(-Ce),u.add(C)}}(),U=function(){const C=new F;return function(Ce,be){n.screenSpacePanning===!0?C.setFromMatrixColumn(be,1):(C.setFromMatrixColumn(be,0),C.crossVectors(n.object.up,C)),C.multiplyScalar(Ce),u.add(C)}}(),B=function(){const C=new F;return function(Ce,be){const re=n.domElement;if(n.object.isPerspectiveCamera){const I=n.object.position;C.copy(I).sub(n.target);let de=C.length();de*=Math.tan(n.object.fov/2*Math.PI/180),P(2*Ce*de/re.clientHeight,n.object.matrix),U(2*be*de/re.clientHeight,n.object.matrix)}else n.object.isOrthographicCamera?(P(Ce*(n.object.right-n.object.left)/n.object.zoom/re.clientWidth,n.object.matrix),U(be*(n.object.top-n.object.bottom)/n.object.zoom/re.clientHeight,n.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),n.enablePan=!1)}}();function k(C){n.object.isPerspectiveCamera||n.object.isOrthographicCamera?c/=C:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),n.enableZoom=!1)}function X(C){n.object.isPerspectiveCamera||n.object.isOrthographicCamera?c*=C:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),n.enableZoom=!1)}function V(C,he){if(!n.zoomToCursor)return;w=!0;const Ce=n.domElement.getBoundingClientRect(),be=C-Ce.left,re=he-Ce.top,I=Ce.width,de=Ce.height;T.x=be/I*2-1,T.y=-(re/de)*2+1,E.set(T.x,T.y,1).unproject(n.object).sub(n.object.position).normalize()}function z(C){return Math.max(n.minDistance,Math.min(n.maxDistance,C))}function ne(C){h.set(C.clientX,C.clientY)}function _e(C){V(C.clientX,C.clientX),d.set(C.clientX,C.clientY)}function Y(C){_.set(C.clientX,C.clientY)}function ee(C){f.set(C.clientX,C.clientY),m.subVectors(f,h).multiplyScalar(n.rotateSpeed);const he=n.domElement;O(2*Math.PI*m.x/he.clientHeight),$(2*Math.PI*m.y/he.clientHeight),h.copy(f),n.update()}function pe(C){M.set(C.clientX,C.clientY),v.subVectors(M,d),v.y>0?k(N(v.y)):v.y<0&&X(N(v.y)),d.copy(M),n.update()}function oe(C){g.set(C.clientX,C.clientY),p.subVectors(g,_).multiplyScalar(n.panSpeed),B(p.x,p.y),_.copy(g),n.update()}function ue(C){V(C.clientX,C.clientY),C.deltaY<0?X(N(C.deltaY)):C.deltaY>0&&k(N(C.deltaY)),n.update()}function Pe(C){let he=!1;switch(C.code){case n.keys.UP:C.ctrlKey||C.metaKey||C.shiftKey?$(2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):B(0,n.keyPanSpeed),he=!0;break;case n.keys.BOTTOM:C.ctrlKey||C.metaKey||C.shiftKey?$(-2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):B(0,-n.keyPanSpeed),he=!0;break;case n.keys.LEFT:C.ctrlKey||C.metaKey||C.shiftKey?O(2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):B(n.keyPanSpeed,0),he=!0;break;case n.keys.RIGHT:C.ctrlKey||C.metaKey||C.shiftKey?O(-2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):B(-n.keyPanSpeed,0),he=!0;break}he&&(C.preventDefault(),n.update())}function Oe(C){if(y.length===1)h.set(C.pageX,C.pageY);else{const he=Se(C),Ce=.5*(C.pageX+he.x),be=.5*(C.pageY+he.y);h.set(Ce,be)}}function Ue(C){if(y.length===1)_.set(C.pageX,C.pageY);else{const he=Se(C),Ce=.5*(C.pageX+he.x),be=.5*(C.pageY+he.y);_.set(Ce,be)}}function He(C){const he=Se(C),Ce=C.pageX-he.x,be=C.pageY-he.y,re=Math.sqrt(Ce*Ce+be*be);d.set(0,re)}function W(C){n.enableZoom&&He(C),n.enablePan&&Ue(C)}function lt(C){n.enableZoom&&He(C),n.enableRotate&&Oe(C)}function we(C){if(y.length==1)f.set(C.pageX,C.pageY);else{const Ce=Se(C),be=.5*(C.pageX+Ce.x),re=.5*(C.pageY+Ce.y);f.set(be,re)}m.subVectors(f,h).multiplyScalar(n.rotateSpeed);const he=n.domElement;O(2*Math.PI*m.x/he.clientHeight),$(2*Math.PI*m.y/he.clientHeight),h.copy(f)}function Re(C){if(y.length===1)g.set(C.pageX,C.pageY);else{const he=Se(C),Ce=.5*(C.pageX+he.x),be=.5*(C.pageY+he.y);g.set(Ce,be)}p.subVectors(g,_).multiplyScalar(n.panSpeed),B(p.x,p.y),_.copy(g)}function De(C){const he=Se(C),Ce=C.pageX-he.x,be=C.pageY-he.y,re=Math.sqrt(Ce*Ce+be*be);M.set(0,re),v.set(0,Math.pow(M.y/d.y,n.zoomSpeed)),k(v.y),d.copy(M);const I=(C.pageX+he.x)*.5,de=(C.pageY+he.y)*.5;V(I,de)}function rt(C){n.enableZoom&&De(C),n.enablePan&&Re(C)}function Be(C){n.enableZoom&&De(C),n.enableRotate&&we(C)}function A(C){n.enabled!==!1&&(y.length===0&&(n.domElement.setPointerCapture(C.pointerId),n.domElement.addEventListener("pointermove",S),n.domElement.addEventListener("pointerup",q)),se(C),C.pointerType==="touch"?Ge(C):ae(C))}function S(C){n.enabled!==!1&&(C.pointerType==="touch"?ie(C):le(C))}function q(C){me(C),y.length===0&&(n.domElement.releasePointerCapture(C.pointerId),n.domElement.removeEventListener("pointermove",S),n.domElement.removeEventListener("pointerup",q)),n.dispatchEvent(jo),r=s.NONE}function ae(C){let he;switch(C.button){case 0:he=n.mouseButtons.LEFT;break;case 1:he=n.mouseButtons.MIDDLE;break;case 2:he=n.mouseButtons.RIGHT;break;default:he=-1}switch(he){case oi.DOLLY:if(n.enableZoom===!1)return;_e(C),r=s.DOLLY;break;case oi.ROTATE:if(C.ctrlKey||C.metaKey||C.shiftKey){if(n.enablePan===!1)return;Y(C),r=s.PAN}else{if(n.enableRotate===!1)return;ne(C),r=s.ROTATE}break;case oi.PAN:if(C.ctrlKey||C.metaKey||C.shiftKey){if(n.enableRotate===!1)return;ne(C),r=s.ROTATE}else{if(n.enablePan===!1)return;Y(C),r=s.PAN}break;default:r=s.NONE}r!==s.NONE&&n.dispatchEvent(Ur)}function le(C){switch(r){case s.ROTATE:if(n.enableRotate===!1)return;ee(C);break;case s.DOLLY:if(n.enableZoom===!1)return;pe(C);break;case s.PAN:if(n.enablePan===!1)return;oe(C);break}}function ce(C){n.enabled===!1||n.enableZoom===!1||r!==s.NONE||(C.preventDefault(),n.dispatchEvent(Ur),ue(Te(C)),n.dispatchEvent(jo))}function Te(C){const he=C.deltaMode,Ce={clientX:C.clientX,clientY:C.clientY,deltaY:C.deltaY};switch(he){case 1:Ce.deltaY*=16;break;case 2:Ce.deltaY*=100;break}return C.ctrlKey&&!x&&(Ce.deltaY*=10),Ce}function xe(C){C.key==="Control"&&(x=!0,document.addEventListener("keyup",ge,{passive:!0,capture:!0}))}function ge(C){C.key==="Control"&&(x=!1,document.removeEventListener("keyup",ge,{passive:!0,capture:!0}))}function Ie(C){n.enabled===!1||n.enablePan===!1||Pe(C)}function Ge(C){switch(Ae(C),y.length){case 1:switch(n.touches.ONE){case li.ROTATE:if(n.enableRotate===!1)return;Oe(C),r=s.TOUCH_ROTATE;break;case li.PAN:if(n.enablePan===!1)return;Ue(C),r=s.TOUCH_PAN;break;default:r=s.NONE}break;case 2:switch(n.touches.TWO){case li.DOLLY_PAN:if(n.enableZoom===!1&&n.enablePan===!1)return;W(C),r=s.TOUCH_DOLLY_PAN;break;case li.DOLLY_ROTATE:if(n.enableZoom===!1&&n.enableRotate===!1)return;lt(C),r=s.TOUCH_DOLLY_ROTATE;break;default:r=s.NONE}break;default:r=s.NONE}r!==s.NONE&&n.dispatchEvent(Ur)}function ie(C){switch(Ae(C),r){case s.TOUCH_ROTATE:if(n.enableRotate===!1)return;we(C),n.update();break;case s.TOUCH_PAN:if(n.enablePan===!1)return;Re(C),n.update();break;case s.TOUCH_DOLLY_PAN:if(n.enableZoom===!1&&n.enablePan===!1)return;rt(C),n.update();break;case s.TOUCH_DOLLY_ROTATE:if(n.enableZoom===!1&&n.enableRotate===!1)return;Be(C),n.update();break;default:r=s.NONE}}function ke(C){n.enabled!==!1&&C.preventDefault()}function se(C){y.push(C.pointerId)}function me(C){delete L[C.pointerId];for(let he=0;he<y.length;he++)if(y[he]==C.pointerId){y.splice(he,1);return}}function Ae(C){let he=L[C.pointerId];he===void 0&&(he=new qe,L[C.pointerId]=he),he.set(C.pageX,C.pageY)}function Se(C){const he=C.pointerId===y[0]?y[1]:y[0];return L[he]}n.domElement.addEventListener("contextmenu",ke),n.domElement.addEventListener("pointerdown",A),n.domElement.addEventListener("pointercancel",q),n.domElement.addEventListener("wheel",ce,{passive:!1}),document.addEventListener("keydown",xe,{passive:!0,capture:!0}),this.update()}}class Em{parse(e,t={}){t=Object.assign({binary:!1},t);const n=t.binary,s=[];let r=0;e.traverse(function(d){if(d.isMesh){const M=d.geometry,v=M.index,E=M.getAttribute("position");r+=v!==null?v.count/3:E.count/3,s.push({object3d:d,geometry:M})}});let a,o=80;if(n===!0){const d=r*2+r*3*4*4+80+4,M=new ArrayBuffer(d);a=new DataView(M),a.setUint32(o,r,!0),o+=4}else a="",a+=`solid exported
`;const l=new F,c=new F,u=new F,h=new F,f=new F,m=new F;for(let d=0,M=s.length;d<M;d++){const v=s[d].object3d,E=s[d].geometry,T=E.index,w=E.getAttribute("position");if(T!==null)for(let y=0;y<T.count;y+=3){const L=T.getX(y+0),x=T.getX(y+1),b=T.getX(y+2);_(L,x,b,w,v)}else for(let y=0;y<w.count;y+=3){const L=y+0,x=y+1,b=y+2;_(L,x,b,w,v)}}return n===!1&&(a+=`endsolid exported
`),a;function _(d,M,v,E,T){l.fromBufferAttribute(E,d),c.fromBufferAttribute(E,M),u.fromBufferAttribute(E,v),T.isSkinnedMesh===!0&&(T.applyBoneTransform(d,l),T.applyBoneTransform(M,c),T.applyBoneTransform(v,u)),l.applyMatrix4(T.matrixWorld),c.applyMatrix4(T.matrixWorld),u.applyMatrix4(T.matrixWorld),g(l,c,u),p(l),p(c),p(u),n===!0?(a.setUint16(o,0,!0),o+=2):(a+=`		endloop
`,a+=`	endfacet
`)}function g(d,M,v){h.subVectors(v,M),f.subVectors(d,M),h.cross(f).normalize(),m.copy(h).normalize(),n===!0?(a.setFloat32(o,m.x,!0),o+=4,a.setFloat32(o,m.y,!0),o+=4,a.setFloat32(o,m.z,!0),o+=4):(a+="	facet normal "+m.x+" "+m.y+" "+m.z+`
`,a+=`		outer loop
`)}function p(d){n===!0?(a.setFloat32(o,d.x,!0),o+=4,a.setFloat32(o,d.y,!0),o+=4,a.setFloat32(o,d.z,!0),o+=4):a+="			vertex "+d.x+" "+d.y+" "+d.z+`
`}}}const ji=It({lattice_constant:.05,cylinder_radius:.015,cylinder_height:.03}),Ds=It({matrix_density:1200,matrix_speed_of_sound:2500,scatterer_density:7800,scatterer_speed_of_sound:5e3}),Ki=It(.28),ym=rc([ji,Ds,Ki],([i,e,t])=>({...i,...e,filling_fraction:t})),Zi=It({start:500,end:800}),Nr=It({budget:50,num_workers:2}),xn=It("idle"),Fr=It(null),Is=It([]),$r=It(null),Zo=It(null),Or=It(null),Jo=It(null),Br=It(!1),zr=It({is_trained:!1,test_rmse:null,n_samples:0}),Hr=It("idle"),bm=It({lattice_constant:{min:.02,max:.1,step:.001,unit:"m",label:"晶格常数"},cylinder_radius:{min:.005,max:.04,step:.001,unit:"m",label:"柱体半径"},cylinder_height:{min:.01,max:.08,step:.001,unit:"m",label:"柱体高度"},matrix_density:{min:800,max:2e3,step:10,unit:"kg/m³",label:"基体密度"},matrix_speed_of_sound:{min:1500,max:4e3,step:50,unit:"m/s",label:"基体声速"},scatterer_density:{min:2e3,max:1e4,step:100,unit:"kg/m³",label:"散射体密度"},scatterer_speed_of_sound:{min:3e3,max:8e3,step:50,unit:"m/s",label:"散射体声速"},filling_fraction:{min:.1,max:.6,step:.01,unit:"",label:"填充率"}});function Tm(i){let e,t,n,s,r='<span class="overlay-label svelte-uznfa2">3D 晶格结构预览</span>',a,o,l,c="⬇ 导出 STL",u,h;return{c(){e=J("div"),t=J("canvas"),n=ye(),s=J("div"),s.innerHTML=r,a=ye(),o=J("div"),l=J("button"),l.textContent=c,this.h()},l(f){e=Z(f,"DIV",{class:!0});var m=fe(e);t=Z(m,"CANVAS",{class:!0}),fe(t).forEach(Q),n=Ee(m),s=Z(m,"DIV",{class:!0,"data-svelte-h":!0}),at(s)!=="svelte-13m55gl"&&(s.innerHTML=r),a=Ee(m),o=Z(m,"DIV",{class:!0});var _=fe(o);l=Z(_,"BUTTON",{class:!0,"data-svelte-h":!0}),at(l)!=="svelte-1mhbf8k"&&(l.textContent=c),_.forEach(Q),m.forEach(Q),this.h()},h(){H(t,"class","svelte-uznfa2"),H(s,"class","viewer-overlay svelte-uznfa2"),H(l,"class","btn btn-secondary btn-sm svelte-uznfa2"),H(o,"class","viewer-actions svelte-uznfa2"),H(e,"class","viewer-container svelte-uznfa2")},m(f,m){$e(f,e,m),D(e,t),i[5](t),D(e,n),D(e,s),D(e,a),D(e,o),D(o,l),u||(h=Et(l,"click",i[1]),u=!0)},p:Ot,i:Ot,o:Ot,d(f){f&&Q(e),i[5](null),u=!1,h()}}}function Am(i,e,t){let n,s;dt(i,Ki,T=>t(3,n=T)),dt(i,ji,T=>t(4,s=T));let r,a,o,l,c,u,h;function f(T,w){return new ii(T,T,w)}function m(T,w,y=64){const L=new ks(T,T,w,y,1,!1);return L.rotateX(Math.PI/2),L}function _(T){const w=new Jn,y=T.lattice_constant,L=T.cylinder_radius,x=T.cylinder_height,b=f(y,x),N=new ko({color:1717853,transparent:!0,opacity:.25,roughness:.3,metalness:.1,side:cn}),O=new Jt(b,N);O.position.set(0,0,0),O.name="matrix",w.add(O);const $=new Ho(b),P=new Hs({color:3900150,opacity:.6,transparent:!0}),U=new Jr($,P);U.position.copy(O.position),w.add(U);const B=m(L,x),k=new ko({color:440020,transparent:!0,opacity:.7,roughness:.2,metalness:.6,clearcoat:.3}),X=new Jt(B,k);X.name="cylinder",w.add(X);const V=new Ho(B),z=new Hs({color:2282478,opacity:.4,transparent:!0}),ne=new Jr(V,z);return ne.position.copy(X.position),w.add(ne),w}function g(T){const w=new Jn,y=T.lattice_constant,L=T.cylinder_radius,x=T.cylinder_height,b=new ii(y,x,y);b.translate(0,x/2,0);const N=new Qr({color:1717853,roughness:.5}),O=new Jt(b,N);O.name="matrix",w.add(O);const $=new ks(L,L,x,64,1,!1);$.translate(0,x/2,0);const P=new Qr({color:440020,roughness:.3,metalness:.5}),U=new Jt($,P);return U.name="cylinder",w.add(U),w}function p(T){const w=new Jn,y=T.lattice_constant,L=3;for(let x=0;x<L;x++)for(let b=0;b<L;b++){const N=_(T);N.position.set((x-(L-1)/2)*y,(b-(L-1)/2)*y,T.cylinder_height/2),w.add(N)}return w}function d(T){o&&(u&&(o.remove(u),u.traverse(w=>{w.geometry&&w.geometry.dispose(),w.material&&(Array.isArray(w.material)?w.material.forEach(y=>y.dispose()):w.material.dispose())})),u=p(T),o.add(u))}function M(){const T={lattice_constant:s.lattice_constant,cylinder_radius:s.cylinder_radius,cylinder_height:s.cylinder_height},w=g(T),L=new Em().parse(w,{binary:!0}),x=new Blob([L],{type:"application/octet-stream"}),b=URL.createObjectURL(x),N=document.createElement("a");N.href=b,N.download=`unit_cell_a${(T.lattice_constant*1e3).toFixed(1)}_r${(T.cylinder_radius*1e3).toFixed(1)}_h${(T.cylinder_height*1e3).toFixed(1)}.stl`,document.body.appendChild(N),N.click(),document.body.removeChild(N),URL.revokeObjectURL(b),w.traverse(O=>{O.geometry&&O.geometry.dispose(),O.material&&(Array.isArray(O.material)?O.material.forEach($=>$.dispose()):O.material.dispose())})}function v(){h=requestAnimationFrame(v),c.update(),a.render(o,l)}Gs(()=>{t(2,o=new dm),t(2,o.background=new it(658970),o),l=new Wt(50,1,.01,100),l.position.set(.15,.15,.25),l.lookAt(0,0,.03),a=new jl({canvas:r,antialias:!0,alpha:!0}),a.setPixelRatio(window.devicePixelRatio),a.toneMapping=_l,a.toneMappingExposure=1.2;const T=new vm(4491519,.5);o.add(T);const w=new Xo(16777215,1);w.position.set(5,5,10),o.add(w);const y=new Xo(440020,.5);y.position.set(-5,-3,5),o.add(y);const L=new _m(9133302,.3,10);L.position.set(0,0,3),o.add(L),o.add(new xm(.5,20,1981023,990510)),c=new Sm(l,r),c.enableDamping=!0,c.dampingFactor=.05,c.minDistance=.05,c.maxDistance=1,c.target.set(0,0,.03),new ResizeObserver(N=>{for(const O of N){const{width:$,height:P}=O.contentRect;$>0&&P>0&&(l.aspect=$/P,l.updateProjectionMatrix(),a.setSize($,P))}}).observe(r.parentElement);const b={lattice_constant:s.lattice_constant,cylinder_radius:s.cylinder_radius,cylinder_height:s.cylinder_height};d(b),v()}),ea(()=>{h&&cancelAnimationFrame(h),a&&a.dispose()});function E(T){Vs[T?"unshift":"push"](()=>{r=T,t(0,r)})}return i.$$.update=()=>{i.$$.dirty&28&&o&&d({lattice_constant:s.lattice_constant,cylinder_radius:s.cylinder_radius,cylinder_height:s.cylinder_height})},[r,M,o,n,s,E]}class wm extends Hn{constructor(e){super(),kn(this,e,Am,Tm,zn,{})}}function Qo(i,e,t){const n=i.slice();n[11]=e[t];const s=n[3][n[11]];n[12]=s;const r=n[1][n[11]];return n[13]=r,n}function $o(i,e,t){const n=i.slice();n[11]=e[t];const s=n[3][n[11]];n[12]=s;const r=n[2][n[11]];return n[13]=r,n}function el(i){let e,t,n,s=i[12].label+"",r,a,o,l=Ni(i[13],i[11])+"",c,u,h=i[12].unit+"",f,m,_,g,p,d,M,v,E;function T(...w){return i[8](i[11],...w)}return{c(){e=J("div"),t=J("div"),n=J("span"),r=je(s),a=ye(),o=J("span"),c=je(l),u=ye(),f=je(h),m=ye(),_=J("input"),this.h()},l(w){e=Z(w,"DIV",{class:!0});var y=fe(e);t=Z(y,"DIV",{class:!0});var L=fe(t);n=Z(L,"SPAN",{});var x=fe(n);r=Ye(x,s),x.forEach(Q),a=Ee(L),o=Z(L,"SPAN",{class:!0});var b=fe(o);c=Ye(b,l),u=Ee(b),f=Ye(b,h),b.forEach(Q),L.forEach(Q),m=Ee(y),_=Z(y,"INPUT",{type:!0,min:!0,max:!0,step:!0}),y.forEach(Q),this.h()},h(){H(o,"class","slider-value"),H(t,"class","slider-label"),H(_,"type","range"),H(_,"min",g=i[12].min),H(_,"max",p=i[12].max),H(_,"step",d=i[12].step),_.value=M=i[13],H(e,"class","slider-container")},m(w,y){$e(w,e,y),D(e,t),D(t,n),D(n,r),D(t,a),D(t,o),D(o,c),D(o,u),D(o,f),D(e,m),D(e,_),v||(E=Et(_,"input",T),v=!0)},p(w,y){i=w,y&8&&s!==(s=i[12].label+"")&&gt(r,s),y&4&&l!==(l=Ni(i[13],i[11])+"")&&gt(c,l),y&8&&h!==(h=i[12].unit+"")&&gt(f,h),y&8&&g!==(g=i[12].min)&&H(_,"min",g),y&8&&p!==(p=i[12].max)&&H(_,"max",p),y&8&&d!==(d=i[12].step)&&H(_,"step",d),y&4&&M!==(M=i[13])&&(_.value=M)},d(w){w&&Q(e),v=!1,E()}}}function tl(i){let e,t,n,s=i[12].label+"",r,a,o,l=Ni(i[13],i[11])+"",c,u,h=i[12].unit+"",f,m,_,g,p,d,M,v,E,T;function w(...y){return i[10](i[11],...y)}return{c(){e=J("div"),t=J("div"),n=J("span"),r=je(s),a=ye(),o=J("span"),c=je(l),u=ye(),f=je(h),m=ye(),_=J("input"),v=ye(),this.h()},l(y){e=Z(y,"DIV",{class:!0});var L=fe(e);t=Z(L,"DIV",{class:!0});var x=fe(t);n=Z(x,"SPAN",{});var b=fe(n);r=Ye(b,s),b.forEach(Q),a=Ee(x),o=Z(x,"SPAN",{class:!0});var N=fe(o);c=Ye(N,l),u=Ee(N),f=Ye(N,h),N.forEach(Q),x.forEach(Q),m=Ee(L),_=Z(L,"INPUT",{type:!0,min:!0,max:!0,step:!0}),v=Ee(L),L.forEach(Q),this.h()},h(){H(o,"class","slider-value"),H(t,"class","slider-label"),H(_,"type","range"),H(_,"min",g=i[12].min),H(_,"max",p=i[12].max),H(_,"step",d=i[12].step),_.value=M=i[13],H(e,"class","slider-container")},m(y,L){$e(y,e,L),D(e,t),D(t,n),D(n,r),D(t,a),D(t,o),D(o,c),D(o,u),D(o,f),D(e,m),D(e,_),D(e,v),E||(T=Et(_,"input",w),E=!0)},p(y,L){i=y,L&8&&s!==(s=i[12].label+"")&&gt(r,s),L&2&&l!==(l=Ni(i[13],i[11])+"")&&gt(c,l),L&8&&h!==(h=i[12].unit+"")&&gt(f,h),L&8&&g!==(g=i[12].min)&&H(_,"min",g),L&8&&p!==(p=i[12].max)&&H(_,"max",p),L&8&&d!==(d=i[12].step)&&H(_,"step",d),L&2&&M!==(M=i[13])&&(_.value=M)},d(y){y&&Q(e),E=!1,T()}}}function Rm(i){let e,t,n,s="结构参数",r,a,o="重置",l,c,u,h,f,m=i[3].filling_fraction.label+"",_,g,p,d=Ni(i[0],"filling_fraction")+"",M,v,E,T,w,y,L,x,b='<h3 class="svelte-1yjtph5">材料参数</h3>',N,O,$,P=un(i[4]),U=[];for(let X=0;X<P.length;X+=1)U[X]=el($o(i,P,X));let B=un(i[5]),k=[];for(let X=0;X<B.length;X+=1)k[X]=tl(Qo(i,B,X));return{c(){e=J("div"),t=J("div"),n=J("h3"),n.textContent=s,r=ye(),a=J("button"),a.textContent=o,l=ye();for(let X=0;X<U.length;X+=1)U[X].c();c=ye(),u=J("div"),h=J("div"),f=J("span"),_=je(m),g=ye(),p=J("span"),M=je(d),v=ye(),E=J("input"),L=ye(),x=J("div"),x.innerHTML=b,N=ye();for(let X=0;X<k.length;X+=1)k[X].c();this.h()},l(X){e=Z(X,"DIV",{class:!0});var V=fe(e);t=Z(V,"DIV",{class:!0});var z=fe(t);n=Z(z,"H3",{class:!0,"data-svelte-h":!0}),at(n)!=="svelte-1v7x7m5"&&(n.textContent=s),r=Ee(z),a=Z(z,"BUTTON",{class:!0,"data-svelte-h":!0}),at(a)!=="svelte-1k1a5qd"&&(a.textContent=o),z.forEach(Q),l=Ee(V);for(let pe=0;pe<U.length;pe+=1)U[pe].l(V);c=Ee(V),u=Z(V,"DIV",{class:!0});var ne=fe(u);h=Z(ne,"DIV",{class:!0});var _e=fe(h);f=Z(_e,"SPAN",{});var Y=fe(f);_=Ye(Y,m),Y.forEach(Q),g=Ee(_e),p=Z(_e,"SPAN",{class:!0});var ee=fe(p);M=Ye(ee,d),ee.forEach(Q),_e.forEach(Q),v=Ee(ne),E=Z(ne,"INPUT",{type:!0,min:!0,max:!0,step:!0}),ne.forEach(Q),L=Ee(V),x=Z(V,"DIV",{class:!0,style:!0,"data-svelte-h":!0}),at(x)!=="svelte-1wqikyx"&&(x.innerHTML=b),N=Ee(V);for(let pe=0;pe<k.length;pe+=1)k[pe].l(V);V.forEach(Q),this.h()},h(){H(n,"class","svelte-1yjtph5"),H(a,"class","btn btn-secondary btn-sm svelte-1yjtph5"),H(t,"class","panel-header svelte-1yjtph5"),H(p,"class","slider-value"),H(h,"class","slider-label"),H(E,"type","range"),H(E,"min",T=i[3].filling_fraction.min),H(E,"max",w=i[3].filling_fraction.max),H(E,"step",y=i[3].filling_fraction.step),E.value=i[0],H(u,"class","slider-container"),H(x,"class","panel-header svelte-1yjtph5"),Pi(x,"margin-top","16px"),H(e,"class","params-panel svelte-1yjtph5")},m(X,V){$e(X,e,V),D(e,t),D(t,n),D(t,r),D(t,a),D(e,l);for(let z=0;z<U.length;z+=1)U[z]&&U[z].m(e,null);D(e,c),D(e,u),D(u,h),D(h,f),D(f,_),D(h,g),D(h,p),D(p,M),D(u,v),D(u,E),D(e,L),D(e,x),D(e,N);for(let z=0;z<k.length;z+=1)k[z]&&k[z].m(e,null);O||($=[Et(a,"click",i[7]),Et(E,"input",i[9])],O=!0)},p(X,[V]){if(V&92){P=un(X[4]);let z;for(z=0;z<P.length;z+=1){const ne=$o(X,P,z);U[z]?U[z].p(ne,V):(U[z]=el(ne),U[z].c(),U[z].m(e,c))}for(;z<U.length;z+=1)U[z].d(1);U.length=P.length}if(V&8&&m!==(m=X[3].filling_fraction.label+"")&&gt(_,m),V&1&&d!==(d=Ni(X[0],"filling_fraction")+"")&&gt(M,d),V&8&&T!==(T=X[3].filling_fraction.min)&&H(E,"min",T),V&8&&w!==(w=X[3].filling_fraction.max)&&H(E,"max",w),V&8&&y!==(y=X[3].filling_fraction.step)&&H(E,"step",y),V&1&&(E.value=X[0]),V&106){B=un(X[5]);let z;for(z=0;z<B.length;z+=1){const ne=Qo(X,B,z);k[z]?k[z].p(ne,V):(k[z]=tl(ne),k[z].c(),k[z].m(e,null))}for(;z<k.length;z+=1)k[z].d(1);k.length=B.length}},i:Ot,o:Ot,d(X){X&&Q(e),Ji(U,X),Ji(k,X),O=!1,Ws($)}}}function Ni(i,e){return e==="filling_fraction"?i.toFixed(2):i>=1e3?i.toFixed(0):i>=1?i.toFixed(1):i.toFixed(3)}function Cm(i,e,t){let n,s,r,a;dt(i,Ki,_=>t(0,n=_)),dt(i,Ds,_=>t(1,s=_)),dt(i,ji,_=>t(2,r=_)),dt(i,bm,_=>t(3,a=_));const o=["lattice_constant","cylinder_radius","cylinder_height"],l=["matrix_density","matrix_speed_of_sound","scatterer_density","scatterer_speed_of_sound"];function c(_,g,p){a[_];const d=parseFloat(g);p==="structural"?ct(ji,r={...r,[_]:d},r):p==="material"?ct(Ds,s={...s,[_]:d},s):ct(Ki,n=d,n)}function u(){ct(ji,r={lattice_constant:.05,cylinder_radius:.015,cylinder_height:.03},r),ct(Ds,s={matrix_density:1200,matrix_speed_of_sound:2500,scatterer_density:7800,scatterer_speed_of_sound:5e3},s),ct(Ki,n=.28,n)}return[n,s,r,a,o,l,c,u,(_,g)=>c(_,g.target.value,"structural"),_=>c("filling_fraction",_.target.value,"filling"),(_,g)=>c(_,g.target.value,"material")]}class Pm extends Hn{constructor(e){super(),kn(this,e,Cm,Rm,zn,{})}}function Lm(i){let e,t;return{c(){e=J("div"),t=J("canvas"),this.h()},l(n){e=Z(n,"DIV",{class:!0});var s=fe(e);t=Z(s,"CANVAS",{class:!0}),fe(t).forEach(Q),s.forEach(Q),this.h()},h(){H(t,"class","svelte-oiz9a6"),H(e,"class","band-structure-container svelte-oiz9a6")},m(n,s){$e(n,e,s),D(e,t),i[2](t)},p:Ot,i:Ot,o:Ot,d(n){n&&Q(e),i[2](null)}}}function Dm(i,e,t){let n,s;dt(i,Zi,u=>t(3,n=u)),dt(i,$r,u=>t(4,s=u));let r,a;const o={top:30,right:30,bottom:40,left:60};function l(){var O;if(!r||!a)return;const u=r.width,h=r.height,f=u-o.left-o.right,m=h-o.top-o.bottom;if(a.clearRect(0,0,u,h),t(1,a.fillStyle="#0f1729",a),a.fillRect(0,0,u,h),t(1,a.strokeStyle="#1e3a5f",a),t(1,a.lineWidth=1,a),a.beginPath(),a.moveTo(o.left,o.top),a.lineTo(o.left,o.top+m),a.lineTo(o.left+f,o.top+m),a.stroke(),t(1,a.fillStyle="#94a3b8",a),t(1,a.font="11px Inter, sans-serif",a),t(1,a.textAlign="center",a),a.fillText("频率 (Hz)",o.left+f/2,h-6),a.save(),a.translate(14,o.top+m/2),a.rotate(-Math.PI/2),a.fillText("波矢 k",0,0),a.restore(),!s){t(1,a.fillStyle="#64748b",a),t(1,a.font="14px Inter, sans-serif",a),t(1,a.textAlign="center",a),a.fillText("等待计算...",o.left+f/2,o.top+m/2);return}const _=s.eigenvalues,g=s.k_path;if(!_||!g||_.length===0)return;const p=_.flat().filter($=>isFinite($));if(p.length===0)return;const d=Math.min(Math.max(...p)*1.1,3e3),M=0,v=n.start,E=n.end,T=o.top+m-(v-M)/(d-M)*m,w=o.top+m-(E-M)/(d-M)*m;t(1,a.fillStyle="rgba(59, 130, 246, 0.1)",a),a.fillRect(o.left,w,f,T-w),t(1,a.strokeStyle="rgba(59, 130, 246, 0.3)",a),t(1,a.lineWidth=1,a),a.setLineDash([4,4]),a.beginPath(),a.moveTo(o.left,T),a.lineTo(o.left+f,T),a.moveTo(o.left,w),a.lineTo(o.left+f,w),a.stroke(),a.setLineDash([]),t(1,a.fillStyle="rgba(59, 130, 246, 0.7)",a),t(1,a.font="10px Inter, sans-serif",a),t(1,a.textAlign="right",a),a.fillText(`目标 ${v}-${E} Hz`,o.left+f-4,w-4);const y=Math.min(((O=_[0])==null?void 0:O.length)||0,10),L=["#3b82f6","#06b6d4","#10b981","#8b5cf6","#f59e0b","#ef4444","#ec4899","#6366f1","#14b8a6","#f97316"];for(let $=0;$<y;$++){t(1,a.strokeStyle=L[$%L.length],a),t(1,a.lineWidth=2,a),a.beginPath();for(let P=0;P<_.length;P++){const U=_[P][$];if(!isFinite(U))continue;const B=o.left+P/(_.length-1)*f,k=o.top+m-(U-M)/(d-M)*m;P===0?a.moveTo(B,k):a.lineTo(B,k)}a.stroke()}const x=5;for(let $=0;$<=x;$++){const P=M+(d-M)*$/x,U=o.top+m-$/x*m;t(1,a.strokeStyle="#1e3a5f",a),t(1,a.lineWidth=1,a),a.beginPath(),a.moveTo(o.left-4,U),a.lineTo(o.left,U),a.stroke(),t(1,a.fillStyle="#94a3b8",a),t(1,a.font="10px monospace",a),t(1,a.textAlign="right",a),a.fillText(Math.round(P).toString(),o.left-8,U+3)}const b=["Γ","X","M","Γ"],N=[0,.33,.66,1];for(let $=0;$<b.length;$++){const P=o.left+N[$]*f;t(1,a.fillStyle="#94a3b8",a),t(1,a.font="12px serif",a),t(1,a.textAlign="center",a),a.fillText(b[$],P,o.top+m+20),t(1,a.strokeStyle="#2a3a5f",a),t(1,a.lineWidth=1,a),a.setLineDash([2,4]),a.beginPath(),a.moveTo(P,o.top),a.lineTo(P,o.top+m),a.stroke(),a.setLineDash([])}}Gs(()=>{const h=r.parentElement.getBoundingClientRect();t(0,r.width=h.width*window.devicePixelRatio,r),t(0,r.height=h.height*window.devicePixelRatio,r),t(0,r.style.width=h.width+"px",r),t(0,r.style.height=h.height+"px",r),t(1,a=r.getContext("2d")),a.scale(window.devicePixelRatio,window.devicePixelRatio),t(0,r.width=h.width,r),t(0,r.height=h.height,r),t(1,a=r.getContext("2d")),l()}),ea(()=>{});function c(u){Vs[u?"unshift":"push"](()=>{r=u,t(0,r)})}return i.$$.update=()=>{i.$$.dirty&2&&a&&l()},[r,a,c]}class Im extends Hn{constructor(e){super(),kn(this,e,Dm,Lm,zn,{})}}const ai="/api";async function Um(i,e,t=50,n=2){const s=await fetch(`${ai}/optimize`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_start:i,target_end:e,budget:t,num_workers:n})});if(!s.ok)throw new Error(`Optimization request failed: ${s.statusText}`);return s.json()}async function Nm(i){const e=await fetch(`${ai}/optimize/${i}`);if(!e.ok)throw new Error(`Status check failed: ${e.statusText}`);return e.json()}async function Fm(i){const e=await fetch(`${ai}/optimize/${i}/history`);if(!e.ok)throw new Error(`History fetch failed: ${e.statusText}`);return e.json()}async function Om(i,e={}){const t=await fetch(`${ai}/compute`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({params:i,compute_band_structure:e.computeBandStructure??!0,compute_transmission_loss:e.computeTransmissionLoss??!1})});if(!t.ok)throw new Error(`Compute request failed: ${t.statusText}`);return t.json()}async function Bm(i=2e3,e=150){const t=await fetch(`${ai}/surrogate/train`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({n_samples:i,epochs:e})});if(!t.ok)throw new Error(`Surrogate training failed: ${t.statusText}`);return t.json()}async function zm(){const i=await fetch(`${ai}/surrogate/info`);if(!i.ok)throw new Error(`Surrogate info fetch failed: ${i.statusText}`);return i.json()}async function Hm(i=500,e=800,t=4096){const n=await fetch(`${ai}/sensitivity/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_start:i,target_end:e,n_samples:t})});if(!n.ok)throw new Error(`Sensitivity analysis failed: ${n.statusText}`);return n.json()}function nl(i,e,t){const n=i.slice();return n[17]=e[t],n[19]=t,n}function il(i,e,t){const n=i.slice();return n[20]=e[t][0],n[21]=e[t][1],n}function sl(i){let e,t,n,s,r,a,o=i[1].length+"",l,c,u=i[0].budget+"",h;return{c(){e=J("div"),t=J("div"),n=J("div"),s=ye(),r=J("div"),a=je("迭代: "),l=je(o),c=je(" / "),h=je(u),this.h()},l(f){e=Z(f,"DIV",{class:!0});var m=fe(e);t=Z(m,"DIV",{class:!0});var _=fe(t);n=Z(_,"DIV",{class:!0,style:!0}),fe(n).forEach(Q),_.forEach(Q),s=Ee(m),r=Z(m,"DIV",{class:!0});var g=fe(r);a=Ye(g,"迭代: "),l=Ye(g,o),c=Ye(g," / "),h=Ye(g,u),g.forEach(Q),m.forEach(Q),this.h()},h(){H(n,"class","progress-bar svelte-1cfmd5i"),Pi(n,"width",i[3]+"%"),H(t,"class","progress-bar-container svelte-1cfmd5i"),H(r,"class","progress-text svelte-1cfmd5i"),H(e,"class","progress-section svelte-1cfmd5i")},m(f,m){$e(f,e,m),D(e,t),D(t,n),D(e,s),D(e,r),D(r,a),D(r,l),D(r,c),D(r,h)},p(f,m){m&8&&Pi(n,"width",f[3]+"%"),m&2&&o!==(o=f[1].length+"")&&gt(l,o),m&1&&u!==(u=f[0].budget+"")&&gt(h,u)},d(f){f&&Q(e)}}}function km(i){let e;return{c(){e=je("▶ 开始优化")},l(t){e=Ye(t,"▶ 开始优化")},m(t,n){$e(t,e,n)},d(t){t&&Q(e)}}}function Gm(i){let e,t="⟳",n;return{c(){e=J("span"),e.textContent=t,n=je(`\r
                优化进行中`),this.h()},l(s){e=Z(s,"SPAN",{class:!0,"data-svelte-h":!0}),at(e)!=="svelte-1qy6d4a"&&(e.textContent=t),n=Ye(s,`\r
                优化进行中`),this.h()},h(){H(e,"class","animate-spin")},m(s,r){$e(s,e,r),$e(s,n,r)},d(s){s&&(Q(e),Q(n))}}}function rl(i){let e,t,n="最优结果",s,r,a,o=un(Object.entries(i[6].params)),l=[];for(let u=0;u<o.length;u+=1)l[u]=al(il(i,o,u));let c=i[6].band_gaps&&i[6].band_gaps.length>0&&ol(i);return{c(){e=J("div"),t=J("div"),t.textContent=n,s=ye(),r=J("div");for(let u=0;u<l.length;u+=1)l[u].c();a=ye(),c&&c.c(),this.h()},l(u){e=Z(u,"DIV",{class:!0});var h=fe(e);t=Z(h,"DIV",{class:!0,"data-svelte-h":!0}),at(t)!=="svelte-xweaac"&&(t.textContent=n),s=Ee(h),r=Z(h,"DIV",{class:!0});var f=fe(r);for(let m=0;m<l.length;m+=1)l[m].l(f);f.forEach(Q),a=Ee(h),c&&c.l(h),h.forEach(Q),this.h()},h(){H(t,"class","section-label svelte-1cfmd5i"),H(r,"class","result-params svelte-1cfmd5i"),H(e,"class","result-section svelte-1cfmd5i")},m(u,h){$e(u,e,h),D(e,t),D(e,s),D(e,r);for(let f=0;f<l.length;f+=1)l[f]&&l[f].m(r,null);D(e,a),c&&c.m(e,null)},p(u,h){if(h&64){o=un(Object.entries(u[6].params));let f;for(f=0;f<o.length;f+=1){const m=il(u,o,f);l[f]?l[f].p(m,h):(l[f]=al(m),l[f].c(),l[f].m(r,null))}for(;f<l.length;f+=1)l[f].d(1);l.length=o.length}u[6].band_gaps&&u[6].band_gaps.length>0?c?c.p(u,h):(c=ol(u),c.c(),c.m(e,null)):c&&(c.d(1),c=null)},d(u){u&&Q(e),Ji(l,u),c&&c.d()}}}function al(i){let e,t,n=i[20]+"",s,r,a,o=(typeof i[21]=="number"?i[21].toPrecision(4):i[21])+"",l,c;return{c(){e=J("div"),t=J("span"),s=je(n),r=ye(),a=J("span"),l=je(o),c=ye(),this.h()},l(u){e=Z(u,"DIV",{class:!0});var h=fe(e);t=Z(h,"SPAN",{class:!0});var f=fe(t);s=Ye(f,n),f.forEach(Q),r=Ee(h),a=Z(h,"SPAN",{class:!0});var m=fe(a);l=Ye(m,o),m.forEach(Q),c=Ee(h),h.forEach(Q),this.h()},h(){H(t,"class","param-key svelte-1cfmd5i"),H(a,"class","param-val svelte-1cfmd5i"),H(e,"class","result-param svelte-1cfmd5i")},m(u,h){$e(u,e,h),D(e,t),D(t,s),D(e,r),D(e,a),D(a,l),D(e,c)},p(u,h){h&64&&n!==(n=u[20]+"")&&gt(s,n),h&64&&o!==(o=(typeof u[21]=="number"?u[21].toPrecision(4):u[21])+"")&&gt(l,o)},d(u){u&&Q(e)}}}function ol(i){let e,t,n="发现的带隙",s,r=un(i[6].band_gaps),a=[];for(let o=0;o<r.length;o+=1)a[o]=ll(nl(i,r,o));return{c(){e=J("div"),t=J("div"),t.textContent=n,s=ye();for(let o=0;o<a.length;o+=1)a[o].c();this.h()},l(o){e=Z(o,"DIV",{class:!0});var l=fe(e);t=Z(l,"DIV",{class:!0,"data-svelte-h":!0}),at(t)!=="svelte-65en9"&&(t.textContent=n),s=Ee(l);for(let c=0;c<a.length;c+=1)a[c].l(l);l.forEach(Q),this.h()},h(){H(t,"class","section-label svelte-1cfmd5i"),H(e,"class","band-gap-results svelte-1cfmd5i")},m(o,l){$e(o,e,l),D(e,t),D(e,s);for(let c=0;c<a.length;c+=1)a[c]&&a[c].m(e,null)},p(o,l){if(l&64){r=un(o[6].band_gaps);let c;for(c=0;c<r.length;c+=1){const u=nl(o,r,c);a[c]?a[c].p(u,l):(a[c]=ll(u),a[c].c(),a[c].m(e,null))}for(;c<a.length;c+=1)a[c].d(1);a.length=r.length}},d(o){o&&Q(e),Ji(a,o)}}}function ll(i){let e,t,n,s=i[19]+1+"",r,a,o,l=Math.round(i[17].start)+"",c,u,h=Math.round(i[17].end)+"",f,m,_;return{c(){e=J("div"),t=J("span"),n=je("带隙 "),r=je(s),a=ye(),o=J("span"),c=je(l),u=je(" - "),f=je(h),m=je(" Hz"),_=ye(),this.h()},l(g){e=Z(g,"DIV",{class:!0});var p=fe(e);t=Z(p,"SPAN",{class:!0});var d=fe(t);n=Ye(d,"带隙 "),r=Ye(d,s),d.forEach(Q),a=Ee(p),o=Z(p,"SPAN",{});var M=fe(o);c=Ye(M,l),u=Ye(M," - "),f=Ye(M,h),m=Ye(M," Hz"),M.forEach(Q),_=Ee(p),p.forEach(Q),this.h()},h(){H(t,"class","badge badge-success"),H(e,"class","gap-item svelte-1cfmd5i")},m(g,p){$e(g,e,p),D(e,t),D(t,n),D(t,r),D(e,a),D(e,o),D(o,c),D(o,u),D(o,f),D(o,m),D(e,_)},p(g,p){p&64&&l!==(l=Math.round(g[17].start)+"")&&gt(c,l),p&64&&h!==(h=Math.round(g[17].end)+"")&&gt(f,h)},d(g){g&&Q(e)}}}function Vm(i){let e,t,n,s="优化控制",r,a,o,l,c,u,h,f="目标带隙频率范围 (Hz)",m,_,g,p,d="起始频率",M,v,E,T,w="—",y,L,x,b="结束频率",N,O,$,P,U,B,k,X="优化迭代次数",V,z,ne=i[0].budget+"",_e,Y,ee,pe,oe,ue,Pe,Oe="并行工作数",Ue,He,W=i[0].num_workers+"",lt,we,Re,De,rt,Be,A,S,q,ae,le="重置",ce,Te,xe,ge=(i[2]==="running"||i[2]==="queued")&&sl(i);function Ie(se,me){return se[2]==="running"||se[2]==="queued"?Gm:km}let Ge=Ie(i),ie=Ge(i),ke=i[6]&&rl(i);return{c(){e=J("div"),t=J("div"),n=J("h3"),n.textContent=s,r=ye(),a=J("span"),o=je(i[5]),c=ye(),u=J("div"),h=J("div"),h.textContent=f,m=ye(),_=J("div"),g=J("div"),p=J("label"),p.textContent=d,M=ye(),v=J("input"),E=ye(),T=J("span"),T.textContent=w,y=ye(),L=J("div"),x=J("label"),x.textContent=b,N=ye(),O=J("input"),$=ye(),P=J("div"),U=J("div"),B=J("div"),k=J("span"),k.textContent=X,V=ye(),z=J("span"),_e=je(ne),Y=ye(),ee=J("input"),pe=ye(),oe=J("div"),ue=J("div"),Pe=J("span"),Pe.textContent=Oe,Ue=ye(),He=J("span"),lt=je(W),we=ye(),Re=J("input"),De=ye(),ge&&ge.c(),rt=ye(),Be=J("div"),A=J("button"),ie.c(),q=ye(),ae=J("button"),ae.textContent=le,ce=ye(),ke&&ke.c(),this.h()},l(se){e=Z(se,"DIV",{class:!0});var me=fe(e);t=Z(me,"DIV",{class:!0});var Ae=fe(t);n=Z(Ae,"H3",{class:!0,"data-svelte-h":!0}),at(n)!=="svelte-vlbtob"&&(n.textContent=s),r=Ee(Ae),a=Z(Ae,"SPAN",{class:!0});var Se=fe(a);o=Ye(Se,i[5]),Se.forEach(Q),Ae.forEach(Q),c=Ee(me),u=Z(me,"DIV",{class:!0});var C=fe(u);h=Z(C,"DIV",{class:!0,"data-svelte-h":!0}),at(h)!=="svelte-1omlzld"&&(h.textContent=f),m=Ee(C),_=Z(C,"DIV",{class:!0});var he=fe(_);g=Z(he,"DIV",{class:!0});var Ce=fe(g);p=Z(Ce,"LABEL",{class:!0,"data-svelte-h":!0}),at(p)!=="svelte-2d7mou"&&(p.textContent=d),M=Ee(Ce),v=Z(Ce,"INPUT",{type:!0,min:!0,max:!0,step:!0}),Ce.forEach(Q),E=Ee(he),T=Z(he,"SPAN",{class:!0,"data-svelte-h":!0}),at(T)!=="svelte-101v1d9"&&(T.textContent=w),y=Ee(he),L=Z(he,"DIV",{class:!0});var be=fe(L);x=Z(be,"LABEL",{class:!0,"data-svelte-h":!0}),at(x)!=="svelte-1f4o2su"&&(x.textContent=b),N=Ee(be),O=Z(be,"INPUT",{type:!0,min:!0,max:!0,step:!0}),be.forEach(Q),he.forEach(Q),C.forEach(Q),$=Ee(me),P=Z(me,"DIV",{class:!0});var re=fe(P);U=Z(re,"DIV",{class:!0});var I=fe(U);B=Z(I,"DIV",{class:!0});var de=fe(B);k=Z(de,"SPAN",{"data-svelte-h":!0}),at(k)!=="svelte-1nepvqd"&&(k.textContent=X),V=Ee(de),z=Z(de,"SPAN",{class:!0});var ve=fe(z);_e=Ye(ve,ne),ve.forEach(Q),de.forEach(Q),Y=Ee(I),ee=Z(I,"INPUT",{type:!0,min:!0,max:!0,step:!0}),I.forEach(Q),pe=Ee(re),oe=Z(re,"DIV",{class:!0});var Fe=fe(oe);ue=Z(Fe,"DIV",{class:!0});var Ne=fe(ue);Pe=Z(Ne,"SPAN",{"data-svelte-h":!0}),at(Pe)!=="svelte-ymnrbt"&&(Pe.textContent=Oe),Ue=Ee(Ne),He=Z(Ne,"SPAN",{class:!0});var Ke=fe(He);lt=Ye(Ke,W),Ke.forEach(Q),Ne.forEach(Q),we=Ee(Fe),Re=Z(Fe,"INPUT",{type:!0,min:!0,max:!0,step:!0}),Fe.forEach(Q),re.forEach(Q),De=Ee(me),ge&&ge.l(me),rt=Ee(me),Be=Z(me,"DIV",{class:!0});var Ve=fe(Be);A=Z(Ve,"BUTTON",{class:!0});var ot=fe(A);ie.l(ot),ot.forEach(Q),q=Ee(Ve),ae=Z(Ve,"BUTTON",{class:!0,"data-svelte-h":!0}),at(ae)!=="svelte-1gng47i"&&(ae.textContent=le),Ve.forEach(Q),ce=Ee(me),ke&&ke.l(me),me.forEach(Q),this.h()},h(){H(n,"class","svelte-1cfmd5i"),H(a,"class",l="badge "+i[4]+" svelte-1cfmd5i"),H(t,"class","panel-header svelte-1cfmd5i"),H(h,"class","section-label svelte-1cfmd5i"),H(p,"class","svelte-1cfmd5i"),H(v,"type","number"),H(v,"min","100"),H(v,"max","5000"),H(v,"step","10"),H(g,"class","input-group svelte-1cfmd5i"),H(T,"class","freq-separator svelte-1cfmd5i"),H(x,"class","svelte-1cfmd5i"),H(O,"type","number"),H(O,"min","100"),H(O,"max","5000"),H(O,"step","10"),H(L,"class","input-group svelte-1cfmd5i"),H(_,"class","freq-inputs svelte-1cfmd5i"),H(u,"class","target-section"),H(z,"class","slider-value"),H(B,"class","slider-label"),H(ee,"type","range"),H(ee,"min","20"),H(ee,"max","200"),H(ee,"step","10"),H(U,"class","slider-container"),H(He,"class","slider-value"),H(ue,"class","slider-label"),H(Re,"type","range"),H(Re,"min","1"),H(Re,"max","8"),H(Re,"step","1"),H(oe,"class","slider-container"),H(P,"class","config-section"),H(A,"class","btn btn-primary svelte-1cfmd5i"),A.disabled=S=i[2]==="running"||i[2]==="queued",H(ae,"class","btn btn-secondary svelte-1cfmd5i"),H(Be,"class","actions svelte-1cfmd5i"),H(e,"class","optimization-panel svelte-1cfmd5i")},m(se,me){$e(se,e,me),D(e,t),D(t,n),D(t,r),D(t,a),D(a,o),D(e,c),D(e,u),D(u,h),D(u,m),D(u,_),D(_,g),D(g,p),D(g,M),D(g,v),En(v,i[7].start),D(_,E),D(_,T),D(_,y),D(_,L),D(L,x),D(L,N),D(L,O),En(O,i[7].end),D(e,$),D(e,P),D(P,U),D(U,B),D(B,k),D(B,V),D(B,z),D(z,_e),D(U,Y),D(U,ee),En(ee,i[0].budget),D(P,pe),D(P,oe),D(oe,ue),D(ue,Pe),D(ue,Ue),D(ue,He),D(He,lt),D(oe,we),D(oe,Re),En(Re,i[0].num_workers),D(e,De),ge&&ge.m(e,null),D(e,rt),D(e,Be),D(Be,A),ie.m(A,null),D(Be,q),D(Be,ae),D(e,ce),ke&&ke.m(e,null),Te||(xe=[Et(v,"input",i[10]),Et(O,"input",i[11]),Et(ee,"change",i[12]),Et(ee,"input",i[12]),Et(Re,"change",i[13]),Et(Re,"input",i[13]),Et(A,"click",i[8]),Et(ae,"click",i[9])],Te=!0)},p(se,[me]){me&32&&gt(o,se[5]),me&16&&l!==(l="badge "+se[4]+" svelte-1cfmd5i")&&H(a,"class",l),me&128&&Ti(v.value)!==se[7].start&&En(v,se[7].start),me&128&&Ti(O.value)!==se[7].end&&En(O,se[7].end),me&1&&ne!==(ne=se[0].budget+"")&&gt(_e,ne),me&1&&En(ee,se[0].budget),me&1&&W!==(W=se[0].num_workers+"")&&gt(lt,W),me&1&&En(Re,se[0].num_workers),se[2]==="running"||se[2]==="queued"?ge?ge.p(se,me):(ge=sl(se),ge.c(),ge.m(e,rt)):ge&&(ge.d(1),ge=null),Ge!==(Ge=Ie(se))&&(ie.d(1),ie=Ge(se),ie&&(ie.c(),ie.m(A,null))),me&4&&S!==(S=se[2]==="running"||se[2]==="queued")&&(A.disabled=S),se[6]?ke?ke.p(se,me):(ke=rl(se),ke.c(),ke.m(e,null)):ke&&(ke.d(1),ke=null)},i:Ot,o:Ot,d(se){se&&Q(e),ge&&ge.d(),ie.d(),ke&&ke.d(),Te=!1,Ws(xe)}}}function Wm(i,e,t){let n,s,r,a,o,l,c,u,h;dt(i,Nr,E=>t(0,a=E)),dt(i,Is,E=>t(1,o=E)),dt(i,Or,E=>t(6,l=E)),dt(i,Fr,E=>t(15,c=E)),dt(i,xn,E=>t(2,u=E)),dt(i,Zi,E=>t(7,h=E));let f;async function m(){try{ct(xn,u="queued",u);const E=await Um(h.start,h.end,a.budget,a.num_workers);E.success?(ct(Fr,c=E.job_id,c),ct(xn,u="running",u),_(E.job_id)):ct(xn,u="failed",u)}catch(E){console.error("Optimization failed:",E),ct(xn,u="failed",u)}}function _(E){f&&clearInterval(f),f=setInterval(async()=>{try{const T=await Fm(E);T.history&&T.history.length>0&&ct(Is,o=T.history,o),T.best_params&&ct(Or,l={params:T.best_params,band_gaps:T.best_band_gaps},l);const w=await Nm(E);w.rq_status==="finished"?(ct(xn,u="completed",u),clearInterval(f)):w.rq_status==="failed"&&(ct(xn,u="failed",u),clearInterval(f))}catch(T){console.error("Polling error:",T)}},3e3)}function g(){f&&clearInterval(f),ct(xn,u="idle",u),ct(Fr,c=null,c),ct(Or,l=null,l),ct(Is,o=[],o)}function p(){h.start=Ti(this.value),Zi.set(h)}function d(){h.end=Ti(this.value),Zi.set(h)}function M(){a.budget=Ti(this.value),Nr.set(a)}function v(){a.num_workers=Ti(this.value),Nr.set(a)}return i.$$.update=()=>{i.$$.dirty&4&&t(5,n={idle:"就绪",queued:"排队中",running:"优化中...",completed:"已完成",failed:"失败"}[u]||"未知"),i.$$.dirty&4&&t(4,s={idle:"badge-info",queued:"badge-warning",running:"badge-warning",completed:"badge-success",failed:"badge-error"}[u]||"badge-info"),i.$$.dirty&3&&t(3,r=o.length>0&&a.budget>0?Math.min(o.length/a.budget*100,100):0)},[a,o,u,r,s,n,l,h,m,g,p,d,M,v]}class Xm extends Hn{constructor(e){super(),kn(this,e,Wm,Vm,zn,{})}}function qm(i){let e,t;return{c(){e=J("div"),t=J("canvas"),this.h()},l(n){e=Z(n,"DIV",{class:!0});var s=fe(e);t=Z(s,"CANVAS",{class:!0}),fe(t).forEach(Q),s.forEach(Q),this.h()},h(){H(t,"class","svelte-1v57vjk"),H(e,"class","history-chart-container svelte-1v57vjk")},m(n,s){$e(n,e,s),D(e,t),i[2](t)},p:Ot,i:Ot,o:Ot,d(n){n&&Q(e),i[2](null)}}}function Ym(i,e,t){let n;dt(i,Is,c=>t(3,n=c));let s,r;const a={top:20,right:20,bottom:30,left:50};function o(){if(!s||!r)return;const c=s.width,u=s.height,h=c-a.left-a.right,f=u-a.top-a.bottom;if(r.clearRect(0,0,c,u),t(1,r.fillStyle="#0f1729",r),r.fillRect(0,0,c,u),t(1,r.strokeStyle="#1e3a5f",r),t(1,r.lineWidth=1,r),r.beginPath(),r.moveTo(a.left,a.top),r.lineTo(a.left,a.top+f),r.lineTo(a.left+h,a.top+f),r.stroke(),t(1,r.fillStyle="#94a3b8",r),t(1,r.font="10px Inter, sans-serif",r),t(1,r.textAlign="center",r),r.fillText("迭代次数",a.left+h/2,u-4),r.save(),r.translate(10,a.top+f/2),r.rotate(-Math.PI/2),r.fillText("目标函数值",0,0),r.restore(),!n||n.length===0){t(1,r.fillStyle="#64748b",r),t(1,r.font="13px Inter, sans-serif",r),t(1,r.textAlign="center",r),r.fillText("等待优化数据...",a.left+h/2,a.top+f/2);return}const m=n.map(v=>v.objective_score),_=Math.max(...m)*1.1,g=Math.min(0,Math.min(...m)*.9),p=r.createLinearGradient(a.left,0,a.left+h,0);p.addColorStop(0,"rgba(59, 130, 246, 0.1)"),p.addColorStop(1,"rgba(6, 182, 212, 0.1)"),r.beginPath();for(let v=0;v<m.length;v++){const E=a.left+v/Math.max(m.length-1,1)*h,T=a.top+f-(m[v]-g)/(_-g)*f;v===0?r.moveTo(E,T):r.lineTo(E,T)}const d=a.left+h;r.lineTo(d,a.top+f),r.lineTo(a.left,a.top+f),r.closePath(),t(1,r.fillStyle=p,r),r.fill(),t(1,r.strokeStyle="#3b82f6",r),t(1,r.lineWidth=2,r),r.beginPath();for(let v=0;v<m.length;v++){const E=a.left+v/Math.max(m.length-1,1)*h,T=a.top+f-(m[v]-g)/(_-g)*f;v===0?r.moveTo(E,T):r.lineTo(E,T)}if(r.stroke(),m.length>0){const v=m.indexOf(Math.min(...m)),E=a.left+v/Math.max(m.length-1,1)*h,T=a.top+f-(m[v]-g)/(_-g)*f;r.beginPath(),r.arc(E,T,5,0,Math.PI*2),t(1,r.fillStyle="#10b981",r),r.fill(),t(1,r.strokeStyle="#ffffff",r),t(1,r.lineWidth=1.5,r),r.stroke(),t(1,r.fillStyle="#10b981",r),t(1,r.font="10px Inter, sans-serif",r),t(1,r.textAlign="left",r),r.fillText(`最优: ${m[v].toFixed(2)}`,E+8,T-4)}const M=4;for(let v=0;v<=M;v++){const E=g+(_-g)*v/M,T=a.top+f-v/M*f;t(1,r.fillStyle="#64748b",r),t(1,r.font="9px monospace",r),t(1,r.textAlign="right",r),r.fillText(E.toFixed(0),a.left-6,T+3)}}Gs(()=>{const u=s.parentElement.getBoundingClientRect();t(0,s.width=u.width,s),t(0,s.height=u.height,s),t(1,r=s.getContext("2d")),o()});function l(c){Vs[c?"unshift":"push"](()=>{s=c,t(0,s)})}return i.$$.update=()=>{i.$$.dirty&2&&r&&o()},[s,r,l]}class jm extends Hn{constructor(e){super(),kn(this,e,Ym,qm,zn,{})}}function cl(i){var m;let e,t,n="⟳",s,r,a="Sobol敏感性分析中...",o,l,c,u=(((m=i[0])==null?void 0:m.sample_count)||4096)+"",h,f;return{c(){e=J("div"),t=J("span"),t.textContent=n,s=ye(),r=J("span"),r.textContent=a,o=ye(),l=J("span"),c=je("分析 "),h=je(u),f=je(" 个样本"),this.h()},l(_){e=Z(_,"DIV",{class:!0});var g=fe(e);t=Z(g,"SPAN",{class:!0,style:!0,"data-svelte-h":!0}),at(t)!=="svelte-1gq3sau"&&(t.textContent=n),s=Ee(g),r=Z(g,"SPAN",{class:!0,"data-svelte-h":!0}),at(r)!=="svelte-1wxgmco"&&(r.textContent=a),o=Ee(g),l=Z(g,"SPAN",{class:!0});var p=fe(l);c=Ye(p,"分析 "),h=Ye(p,u),f=Ye(p," 个样本"),p.forEach(Q),g.forEach(Q),this.h()},h(){H(t,"class","animate-spin"),Pi(t,"font-size","24px"),H(r,"class","loading-text svelte-1idine6"),H(l,"class","loading-subtext svelte-1idine6"),H(e,"class","loading-overlay svelte-1idine6")},m(_,g){$e(_,e,g),D(e,t),D(e,s),D(e,r),D(e,o),D(e,l),D(l,c),D(l,h),D(l,f)},p(_,g){var p;g&1&&u!==(u=(((p=_[0])==null?void 0:p.sample_count)||4096)+"")&&gt(h,u)},d(_){_&&Q(e)}}}function Km(i){let e,t,n,s=i[1]&&cl(i);return{c(){e=J("div"),t=J("canvas"),n=ye(),s&&s.c(),this.h()},l(r){e=Z(r,"DIV",{class:!0});var a=fe(e);t=Z(a,"CANVAS",{class:!0}),fe(t).forEach(Q),n=Ee(a),s&&s.l(a),a.forEach(Q),this.h()},h(){H(t,"class","svelte-1idine6"),H(e,"class","radar-container svelte-1idine6")},m(r,a){$e(r,e,a),D(e,t),i[4](t),D(e,n),s&&s.m(e,null)},p(r,[a]){r[1]?s?s.p(r,a):(s=cl(r),s.c(),s.m(e,null)):s&&(s.d(1),s=null)},i:Ot,o:Ot,d(r){r&&Q(e),i[4](null),s&&s.d()}}}function Zm(i,e,t){let{sensitivityData:n=null}=e,{loading:s=!1}=e,r,a;const o={first_order:"#3b82f6",total_order:"#06b6d4",grid:"#1e3a5f",text:"#94a3b8",highlight:"#8b5cf6"};function l(){if(!r||!a)return;const _=r.width,g=r.height,p=_/2,d=g/2,M=Math.min(_,g)/2-50;if(a.clearRect(0,0,_,g),t(3,a.fillStyle="#0f1729",a),a.fillRect(0,0,_,g),!n||!n.first_order){t(3,a.fillStyle="#64748b",a),t(3,a.font="14px Inter, sans-serif",a),t(3,a.textAlign="center",a),a.fillText(s?"计算中...":'点击"分析参数敏感性"开始',p,d);return}const v=n.param_names_cn||n.param_names,E=n.first_order,T=n.total_order,w=v.length,y=Math.max(...E,...T,.01);for(let L=1;L<=5;L++){const x=L/5*M;t(3,a.strokeStyle=o.grid,a),t(3,a.lineWidth=.5,a),a.beginPath();for(let N=0;N<=w;N++){const O=N/w*Math.PI*2-Math.PI/2,$=p+Math.cos(O)*x,P=d+Math.sin(O)*x;N===0?a.moveTo($,P):a.lineTo($,P)}a.closePath(),a.stroke(),t(3,a.fillStyle="#475569",a),t(3,a.font="9px monospace",a),t(3,a.textAlign="left",a);const b=(L/5*y).toFixed(2);a.fillText(b,p+x+4,d+3)}for(let L=0;L<w;L++){const x=L/w*Math.PI*2-Math.PI/2,b=p+Math.cos(x)*(M+30),N=d+Math.sin(x)*(M+30);t(3,a.strokeStyle="#2a3a5f",a),t(3,a.lineWidth=.5,a),a.setLineDash([2,4]),a.beginPath(),a.moveTo(p,d),a.lineTo(p+Math.cos(x)*M,d+Math.sin(x)*M),a.stroke(),a.setLineDash([]),t(3,a.fillStyle=o.text,a),t(3,a.font="11px Inter, sans-serif",a),t(3,a.textAlign="center",a),t(3,a.textBaseline="middle",a);const O=v[L],$=T[L],P=$>.15;P&&(t(3,a.fillStyle=o.highlight,a),t(3,a.font="bold 11px Inter, sans-serif",a)),a.fillText(O,b,N),P&&(t(3,a.font="bold 9px monospace",a),t(3,a.fillStyle=o.highlight,a),a.fillText(`ST=${$.toFixed(2)}`,b,N+12))}c(E,p,d,M,y,o.first_order,.3,1.5),c(T,p,d,M,y,o.total_order,.15,2),u(p,g-20),n.ranking&&h(n.ranking,10,10)}function c(_,g,p,d,M,v,E,T){const w=_.length;t(3,a.strokeStyle=v,a),t(3,a.lineWidth=T,a),t(3,a.fillStyle=v+Math.floor(E*255).toString(16).padStart(2,"0"),a),a.beginPath();for(let y=0;y<=w;y++){const L=y%w,x=L/w*Math.PI*2-Math.PI/2,b=_[L]/M*d,N=g+Math.cos(x)*b,O=p+Math.sin(x)*b;y===0?a.moveTo(N,O):a.lineTo(N,O)}a.closePath(),a.fill(),a.stroke();for(let y=0;y<w;y++){const L=y/w*Math.PI*2-Math.PI/2,x=_[y]/M*d,b=g+Math.cos(L)*x,N=p+Math.sin(L)*x;t(3,a.fillStyle=v,a),a.beginPath(),a.arc(b,N,3,0,Math.PI*2),a.fill()}}function u(_,g){const p=[{label:"一阶Sobol (S1)",color:o.first_order},{label:"总Sobol (ST)",color:o.total_order}],d=120,M=_-d*p.length/2;p.forEach((v,E)=>{const T=M+E*d;t(3,a.fillStyle=v.color,a),a.fillRect(T,g-8,16,3),t(3,a.fillStyle=o.text,a),t(3,a.font="10px Inter, sans-serif",a),t(3,a.textAlign="left",a),t(3,a.textBaseline="middle",a),a.fillText(v.label,T+22,g)})}function h(_,g,p){const d=_.slice(0,3);t(3,a.fillStyle="rgba(10, 14, 26, 0.8)",a),a.fillRect(g,p,180,90),t(3,a.strokeStyle="#1e3a5f",a),t(3,a.lineWidth=1,a),a.strokeRect(g,p,180,90),t(3,a.fillStyle="#94a3b8",a),t(3,a.font="bold 11px Inter, sans-serif",a),t(3,a.textAlign="left",a),a.fillText("参数重要性排名",g+10,p+18),d.forEach((M,v)=>{const E=p+38+v*22;t(3,a.fillStyle=["#fbbf24","#94a3b8","#a16207"][v],a),t(3,a.font="bold 14px Inter, sans-serif",a),a.fillText(`#${v+1}`,g+10,E),t(3,a.fillStyle="#e2e8f0",a),t(3,a.font="11px Inter, sans-serif",a),a.fillText(M.param_name_cn,g+40,E),t(3,a.fillStyle="#06b6d4",a),t(3,a.font="bold 10px monospace",a),t(3,a.textAlign="right",a),a.fillText(`${M.contribution_pct.toFixed(0)}%`,g+170,E)})}function f(){if(!r)return;const _=r.parentElement.getBoundingClientRect();t(2,r.width=_.width,r),t(2,r.height=_.height,r),t(3,a=r.getContext("2d")),l()}Gs(()=>{t(3,a=r.getContext("2d")),f(),window.addEventListener("resize",f)}),ea(()=>{window.removeEventListener("resize",f)});function m(_){Vs[_?"unshift":"push"](()=>{r=_,t(2,r)})}return i.$$set=_=>{"sensitivityData"in _&&t(0,n=_.sensitivityData),"loading"in _&&t(1,s=_.loading)},i.$$.update=()=>{i.$$.dirty&8&&a&&l()},[n,s,r,a,m]}class Zl extends Hn{constructor(e){super(),kn(this,e,Zm,Km,zn,{sensitivityData:0,loading:1})}}function ul(i,e,t){const n=i.slice();return n[8]=e[t],n}function Jm(i){let e,t="未训练";return{c(){e=J("span"),e.textContent=t,this.h()},l(n){e=Z(n,"SPAN",{class:!0,"data-svelte-h":!0}),at(e)!=="svelte-6s4r0i"&&(e.textContent=t),this.h()},h(){H(e,"class","badge badge-warning")},m(n,s){$e(n,e,s)},d(n){n&&Q(e)}}}function Qm(i){let e,t="已训练";return{c(){e=J("span"),e.textContent=t,this.h()},l(n){e=Z(n,"SPAN",{class:!0,"data-svelte-h":!0}),at(e)!=="svelte-mb0ly9"&&(e.textContent=t),this.h()},h(){H(e,"class","badge badge-success")},m(n,s){$e(n,e,s)},d(n){n&&Q(e)}}}function hl(i){var p;let e,t,n="测试集RMSE:",s,r,a=(((p=i[0].test_rmse)==null?void 0:p.toFixed(2))||"N/A")+"",o,l,c,u,h="训练样本数:",f,m,_=(i[0].n_samples||0)+"",g;return{c(){e=J("div"),t=J("span"),t.textContent=n,s=ye(),r=J("span"),o=je(a),l=ye(),c=J("div"),u=J("span"),u.textContent=h,f=ye(),m=J("span"),g=je(_),this.h()},l(d){e=Z(d,"DIV",{class:!0});var M=fe(e);t=Z(M,"SPAN",{class:!0,"data-svelte-h":!0}),at(t)!=="svelte-442py5"&&(t.textContent=n),s=Ee(M),r=Z(M,"SPAN",{class:!0});var v=fe(r);o=Ye(v,a),v.forEach(Q),M.forEach(Q),l=Ee(d),c=Z(d,"DIV",{class:!0});var E=fe(c);u=Z(E,"SPAN",{class:!0,"data-svelte-h":!0}),at(u)!=="svelte-oxq18z"&&(u.textContent=h),f=Ee(E),m=Z(E,"SPAN",{class:!0});var T=fe(m);g=Ye(T,_),T.forEach(Q),E.forEach(Q),this.h()},h(){H(t,"class","info-label svelte-eyfvrk"),H(r,"class","info-value svelte-eyfvrk"),H(e,"class","info-row svelte-eyfvrk"),H(u,"class","info-label svelte-eyfvrk"),H(m,"class","info-value svelte-eyfvrk"),H(c,"class","info-row svelte-eyfvrk")},m(d,M){$e(d,e,M),D(e,t),D(e,s),D(e,r),D(r,o),$e(d,l,M),$e(d,c,M),D(c,u),D(c,f),D(c,m),D(m,g)},p(d,M){var v;M&1&&a!==(a=(((v=d[0].test_rmse)==null?void 0:v.toFixed(2))||"N/A")+"")&&gt(o,a),M&1&&_!==(_=(d[0].n_samples||0)+"")&&gt(g,_)},d(d){d&&(Q(e),Q(l),Q(c))}}}function $m(i){let e;return{c(){e=je("🧠 训练代理模型")},l(t){e=Ye(t,"🧠 训练代理模型")},m(t,n){$e(t,e,n)},d(t){t&&Q(e)}}}function e_(i){let e,t="⟳",n;return{c(){e=J("span"),e.textContent=t,n=je(`
                训练中...`),this.h()},l(s){e=Z(s,"SPAN",{class:!0,"data-svelte-h":!0}),at(e)!=="svelte-1qy6d4a"&&(e.textContent=t),n=Ye(s,`
                训练中...`),this.h()},h(){H(e,"class","animate-spin")},m(s,r){$e(s,e,r),$e(s,n,r)},d(s){s&&(Q(e),Q(n))}}}function t_(i){let e;return{c(){e=je("📊 分析参数敏感性")},l(t){e=Ye(t,"📊 分析参数敏感性")},m(t,n){$e(t,e,n)},d(t){t&&Q(e)}}}function n_(i){let e,t="⟳",n;return{c(){e=J("span"),e.textContent=t,n=je(`
                分析中...`),this.h()},l(s){e=Z(s,"SPAN",{class:!0,"data-svelte-h":!0}),at(e)!=="svelte-1qy6d4a"&&(e.textContent=t),n=Ye(s,`
                分析中...`),this.h()},h(){H(e,"class","animate-spin")},m(s,r){$e(s,e,r),$e(s,n,r)},d(s){s&&(Q(e),Q(n))}}}function fl(i){let e,t,n="详细排名",s,r,a=un(i[3].ranking),o=[];for(let l=0;l<a.length;l+=1)o[l]=dl(ul(i,a,l));return{c(){e=J("div"),t=J("div"),t.textContent=n,s=ye(),r=J("div");for(let l=0;l<o.length;l+=1)o[l].c();this.h()},l(l){e=Z(l,"DIV",{class:!0});var c=fe(e);t=Z(c,"DIV",{class:!0,"data-svelte-h":!0}),at(t)!=="svelte-13btaai"&&(t.textContent=n),s=Ee(c),r=Z(c,"DIV",{class:!0});var u=fe(r);for(let h=0;h<o.length;h+=1)o[h].l(u);u.forEach(Q),c.forEach(Q),this.h()},h(){H(t,"class","section-label svelte-eyfvrk"),H(r,"class","ranking-table svelte-eyfvrk"),H(e,"class","sensitivity-details svelte-eyfvrk")},m(l,c){$e(l,e,c),D(e,t),D(e,s),D(e,r);for(let u=0;u<o.length;u+=1)o[u]&&o[u].m(r,null)},p(l,c){if(c&8){a=un(l[3].ranking);let u;for(u=0;u<a.length;u+=1){const h=ul(l,a,u);o[u]?o[u].p(h,c):(o[u]=dl(h),o[u].c(),o[u].m(r,null))}for(;u<o.length;u+=1)o[u].d(1);o.length=a.length}},d(l){l&&Q(e),Ji(o,l)}}}function dl(i){let e,t,n,s=i[8].rank+"",r,a,o,l=i[8].param_name_cn+"",c,u,h,f,m,_,g=i[8].contribution_pct.toFixed(0)+"",p,d,M;return{c(){e=J("div"),t=J("span"),n=je("#"),r=je(s),a=ye(),o=J("span"),c=je(l),u=ye(),h=J("div"),f=J("div"),m=ye(),_=J("span"),p=je(g),d=je("%"),M=ye(),this.h()},l(v){e=Z(v,"DIV",{class:!0});var E=fe(e);t=Z(E,"SPAN",{class:!0});var T=fe(t);n=Ye(T,"#"),r=Ye(T,s),T.forEach(Q),a=Ee(E),o=Z(E,"SPAN",{class:!0});var w=fe(o);c=Ye(w,l),w.forEach(Q),u=Ee(E),h=Z(E,"DIV",{class:!0});var y=fe(h);f=Z(y,"DIV",{class:!0,style:!0}),fe(f).forEach(Q),y.forEach(Q),m=Ee(E),_=Z(E,"SPAN",{class:!0});var L=fe(_);p=Ye(L,g),d=Ye(L,"%"),L.forEach(Q),M=Ee(E),E.forEach(Q),this.h()},h(){H(t,"class","rank-badge svelte-eyfvrk"),H(o,"class","rank-name svelte-eyfvrk"),H(f,"class","rank-bar-fill svelte-eyfvrk"),Pi(f,"width",i[8].contribution_pct+"%"),H(h,"class","rank-bar svelte-eyfvrk"),H(_,"class","rank-value svelte-eyfvrk"),H(e,"class","ranking-row svelte-eyfvrk")},m(v,E){$e(v,e,E),D(e,t),D(t,n),D(t,r),D(e,a),D(e,o),D(o,c),D(e,u),D(e,h),D(h,f),D(e,m),D(e,_),D(_,p),D(_,d),D(e,M)},p(v,E){E&8&&s!==(s=v[8].rank+"")&&gt(r,s),E&8&&l!==(l=v[8].param_name_cn+"")&&gt(c,l),E&8&&Pi(f,"width",v[8].contribution_pct+"%"),E&8&&g!==(g=v[8].contribution_pct.toFixed(0)+"")&&gt(p,g)},d(v){v&&Q(e)}}}function i_(i){var pe;let e,t,n='<h3 class="svelte-eyfvrk">全局参数敏感性分析</h3> <span class="badge badge-info">Sobol指数</span>',s,r,a,o,l="代理模型状态:",c,u,h,f,m,_,g,p,d,M,v,E,T,w,y,L,x,b,N,O,$;function P(oe,ue){return oe[0].is_trained?Qm:Jm}let U=P(i),B=U(i),k=i[0].is_trained&&hl(i);function X(oe,ue){return oe[1]==="training"?e_:$m}let V=X(i),z=V(i);T=new Zl({props:{sensitivityData:i[3],loading:i[2]}});function ne(oe,ue){return oe[2]?n_:t_}let _e=ne(i),Y=_e(i),ee=((pe=i[3])==null?void 0:pe.ranking)&&fl(i);return{c(){e=J("div"),t=J("div"),t.innerHTML=n,s=ye(),r=J("div"),a=J("div"),o=J("span"),o.textContent=l,c=ye(),B.c(),u=ye(),k&&k.c(),h=ye(),f=J("div"),m=J("button"),z.c(),g=ye(),p=J("button"),d=je("↻ 刷新"),v=ye(),E=J("div"),Dn(T.$$.fragment),w=ye(),y=J("div"),L=J("button"),Y.c(),b=ye(),ee&&ee.c(),this.h()},l(oe){e=Z(oe,"DIV",{class:!0});var ue=fe(e);t=Z(ue,"DIV",{class:!0,"data-svelte-h":!0}),at(t)!=="svelte-e0poz4"&&(t.innerHTML=n),s=Ee(ue),r=Z(ue,"DIV",{class:!0});var Pe=fe(r);a=Z(Pe,"DIV",{class:!0});var Oe=fe(a);o=Z(Oe,"SPAN",{class:!0,"data-svelte-h":!0}),at(o)!=="svelte-1ix6e5q"&&(o.textContent=l),c=Ee(Oe),B.l(Oe),Oe.forEach(Q),u=Ee(Pe),k&&k.l(Pe),Pe.forEach(Q),h=Ee(ue),f=Z(ue,"DIV",{class:!0});var Ue=fe(f);m=Z(Ue,"BUTTON",{class:!0});var He=fe(m);z.l(He),He.forEach(Q),g=Ee(Ue),p=Z(Ue,"BUTTON",{class:!0});var W=fe(p);d=Ye(W,"↻ 刷新"),W.forEach(Q),Ue.forEach(Q),v=Ee(ue),E=Z(ue,"DIV",{class:!0});var lt=fe(E);Ln(T.$$.fragment,lt),lt.forEach(Q),w=Ee(ue),y=Z(ue,"DIV",{class:!0});var we=fe(y);L=Z(we,"BUTTON",{class:!0});var Re=fe(L);Y.l(Re),Re.forEach(Q),we.forEach(Q),b=Ee(ue),ee&&ee.l(ue),ue.forEach(Q),this.h()},h(){H(t,"class","panel-header svelte-eyfvrk"),H(o,"class","info-label svelte-eyfvrk"),H(a,"class","info-row svelte-eyfvrk"),H(r,"class","model-info svelte-eyfvrk"),H(m,"class","btn btn-secondary btn-sm svelte-eyfvrk"),m.disabled=_=i[1]==="training",H(p,"class","btn btn-secondary btn-sm svelte-eyfvrk"),p.disabled=M=i[1]==="training",H(f,"class","model-actions svelte-eyfvrk"),H(E,"class","radar-wrapper svelte-eyfvrk"),H(L,"class","btn btn-primary btn-sm svelte-eyfvrk"),L.disabled=x=i[2]||i[1]==="training",H(y,"class","analysis-actions svelte-eyfvrk"),H(e,"class","analysis-panel svelte-eyfvrk")},m(oe,ue){$e(oe,e,ue),D(e,t),D(e,s),D(e,r),D(r,a),D(a,o),D(a,c),B.m(a,null),D(r,u),k&&k.m(r,null),D(e,h),D(e,f),D(f,m),z.m(m,null),D(f,g),D(f,p),D(p,d),D(e,v),D(e,E),Pn(T,E,null),D(e,w),D(e,y),D(y,L),Y.m(L,null),D(e,b),ee&&ee.m(e,null),N=!0,O||($=[Et(m,"click",i[5]),Et(p,"click",i[6]),Et(L,"click",i[4])],O=!0)},p(oe,[ue]){var Oe;U!==(U=P(oe))&&(B.d(1),B=U(oe),B&&(B.c(),B.m(a,null))),oe[0].is_trained?k?k.p(oe,ue):(k=hl(oe),k.c(),k.m(r,null)):k&&(k.d(1),k=null),V!==(V=X(oe))&&(z.d(1),z=V(oe),z&&(z.c(),z.m(m,null))),(!N||ue&2&&_!==(_=oe[1]==="training"))&&(m.disabled=_),(!N||ue&2&&M!==(M=oe[1]==="training"))&&(p.disabled=M);const Pe={};ue&8&&(Pe.sensitivityData=oe[3]),ue&4&&(Pe.loading=oe[2]),T.$set(Pe),_e!==(_e=ne(oe))&&(Y.d(1),Y=_e(oe),Y&&(Y.c(),Y.m(L,null))),(!N||ue&6&&x!==(x=oe[2]||oe[1]==="training"))&&(L.disabled=x),(Oe=oe[3])!=null&&Oe.ranking?ee?ee.p(oe,ue):(ee=fl(oe),ee.c(),ee.m(e,null)):ee&&(ee.d(1),ee=null)},i(oe){N||(on(T.$$.fragment,oe),N=!0)},o(oe){an(T.$$.fragment,oe),N=!1},d(oe){oe&&Q(e),B.d(),k&&k.d(),z.d(),Cn(T),Y.d(),ee&&ee.d(),O=!1,Ws($)}}}function s_(i,e,t){let n,s,r,a,o;dt(i,zr,h=>t(0,n=h)),dt(i,Hr,h=>t(1,s=h)),dt(i,Br,h=>t(2,r=h)),dt(i,Jo,h=>t(3,a=h)),dt(i,Zi,h=>t(7,o=h));async function l(){ct(Br,r=!0,r);try{const h=await Hm(o.start,o.end,4096);ct(Jo,a=h,a)}catch(h){console.error("Sensitivity analysis failed:",h)}finally{ct(Br,r=!1,r)}}async function c(){ct(Hr,s="training",s);try{const h=await Bm(2e3,150);ct(zr,n={is_trained:!0,test_rmse:h.test_rmse,n_samples:h.n_train_samples},n)}catch(h){console.error("Surrogate training failed:",h)}finally{ct(Hr,s="idle",s)}}async function u(){try{const h=await zm();ct(zr,n=h,n)}catch(h){console.error("Failed to get model info:",h)}}return[n,s,r,a,l,c,u]}class r_ extends Hn{constructor(e){super(),kn(this,e,s_,i_,zn,{})}}function a_(i){let e;return{c(){e=je("系统就绪")},l(t){e=Ye(t,"系统就绪")},m(t,n){$e(t,e,n)},d(t){t&&Q(e)}}}function o_(i){let e;return{c(){e=je("优化运行中")},l(t){e=Ye(t,"优化运行中")},m(t,n){$e(t,e,n)},d(t){t&&Q(e)}}}function l_(i){let e;return{c(){e=je("⚡ 计算能带结构")},l(t){e=Ye(t,"⚡ 计算能带结构")},m(t,n){$e(t,e,n)},d(t){t&&Q(e)}}}function c_(i){let e,t="⟳",n;return{c(){e=J("span"),e.textContent=t,n=je(`\r
                        计算中...`),this.h()},l(s){e=Z(s,"SPAN",{class:!0,"data-svelte-h":!0}),at(e)!=="svelte-1qy6d4a"&&(e.textContent=t),n=Ye(s,`\r
                        计算中...`),this.h()},h(){H(e,"class","animate-spin")},m(s,r){$e(s,e,r),$e(s,n,r)},d(s){s&&(Q(e),Q(n))}}}function u_(i){let e,t,n;return t=new r_({}),{c(){e=J("div"),Dn(t.$$.fragment),this.h()},l(s){e=Z(s,"DIV",{class:!0});var r=fe(e);Ln(t.$$.fragment,r),r.forEach(Q),this.h()},h(){H(e,"class","analysis-section svelte-251ly0")},m(s,r){$e(s,e,r),Pn(t,e,null),n=!0},i(s){n||(on(t.$$.fragment,s),n=!0)},o(s){an(t.$$.fragment,s),n=!1},d(s){s&&Q(e),Cn(t)}}}function h_(i){let e,t,n;return t=new Xm({}),{c(){e=J("div"),Dn(t.$$.fragment),this.h()},l(s){e=Z(s,"DIV",{class:!0});var r=fe(e);Ln(t.$$.fragment,r),r.forEach(Q),this.h()},h(){H(e,"class","optimization-section card svelte-251ly0")},m(s,r){$e(s,e,r),Pn(t,e,null),n=!0},i(s){n||(on(t.$$.fragment,s),n=!0)},o(s){an(t.$$.fragment,s),n=!1},d(s){s&&Q(e),Cn(t)}}}function f_(i){let e,t,n,s,r='<div class="logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="1.5"></circle><circle cx="12" cy="12" r="6" stroke="#06b6d4" stroke-width="1.5"></circle><circle cx="12" cy="12" r="2" fill="#8b5cf6"></circle><line x1="12" y1="2" x2="12" y2="22" stroke="#1e3a5f" stroke-width="0.5"></line><line x1="2" y1="12" x2="22" y2="12" stroke="#1e3a5f" stroke-width="0.5"></line></svg></div> <div class="header-title svelte-251ly0"><h1 class="svelte-251ly0">声学超材料逆向设计系统</h1> <span class="subtitle svelte-251ly0">Acoustic Metamaterial Inverse Design</span></div>',a,o,l,c,u,h,f,m,_,g,p,d,M,v,E,T,w,y,L,x,b="🎯 优化",N,O,$="📊 分析",P,U,B,k,X,V,z,ne,_e='<span class="chart-title svelte-251ly0">能带结构</span>',Y,ee,pe,oe,ue,Pe,Oe='<span class="chart-title svelte-251ly0">优化历史</span>',Ue,He,W,lt,we,Re,De='<span class="chart-title svelte-251ly0">参数敏感性</span>',rt,Be,A,S,q,ae;function le(se,me){return se[2]==="running"?o_:a_}let ce=le(i),Te=ce(i);_=new Pm({}),M=new wm({});function xe(se,me){return se[0]?c_:l_}let ge=xe(i),Ie=ge(i);const Ge=[h_,u_],ie=[];function ke(se,me){return se[1]==="optimization"?0:1}return B=ke(i),k=ie[B]=Ge[B](i),pe=new Im({}),W=new jm({}),A=new Zl({}),{c(){e=ye(),t=J("div"),n=J("header"),s=J("div"),s.innerHTML=r,a=ye(),o=J("div"),l=J("span"),c=ye(),u=J("span"),Te.c(),h=ye(),f=J("main"),m=J("aside"),Dn(_.$$.fragment),g=ye(),p=J("section"),d=J("div"),Dn(M.$$.fragment),v=ye(),E=J("div"),T=J("button"),Ie.c(),w=ye(),y=J("aside"),L=J("div"),x=J("button"),x.textContent=b,N=ye(),O=J("button"),O.textContent=$,P=ye(),U=J("div"),k.c(),X=ye(),V=J("footer"),z=J("div"),ne=J("div"),ne.innerHTML=_e,Y=ye(),ee=J("div"),Dn(pe.$$.fragment),oe=ye(),ue=J("div"),Pe=J("div"),Pe.innerHTML=Oe,Ue=ye(),He=J("div"),Dn(W.$$.fragment),lt=ye(),we=J("div"),Re=J("div"),Re.innerHTML=De,rt=ye(),Be=J("div"),Dn(A.$$.fragment),this.h()},l(se){ic("svelte-1mnt88x",document.head).forEach(Q),e=Ee(se),t=Z(se,"DIV",{class:!0});var Ae=fe(t);n=Z(Ae,"HEADER",{class:!0});var Se=fe(n);s=Z(Se,"DIV",{class:!0,"data-svelte-h":!0}),at(s)!=="svelte-oq12a4"&&(s.innerHTML=r),a=Ee(Se),o=Z(Se,"DIV",{class:!0});var C=fe(o);l=Z(C,"SPAN",{class:!0}),fe(l).forEach(Q),c=Ee(C),u=Z(C,"SPAN",{class:!0});var he=fe(u);Te.l(he),he.forEach(Q),C.forEach(Q),Se.forEach(Q),h=Ee(Ae),f=Z(Ae,"MAIN",{class:!0});var Ce=fe(f);m=Z(Ce,"ASIDE",{class:!0});var be=fe(m);Ln(_.$$.fragment,be),be.forEach(Q),g=Ee(Ce),p=Z(Ce,"SECTION",{class:!0});var re=fe(p);d=Z(re,"DIV",{class:!0});var I=fe(d);Ln(M.$$.fragment,I),I.forEach(Q),v=Ee(re),E=Z(re,"DIV",{class:!0});var de=fe(E);T=Z(de,"BUTTON",{class:!0});var ve=fe(T);Ie.l(ve),ve.forEach(Q),de.forEach(Q),re.forEach(Q),w=Ee(Ce),y=Z(Ce,"ASIDE",{class:!0});var Fe=fe(y);L=Z(Fe,"DIV",{class:!0});var Ne=fe(L);x=Z(Ne,"BUTTON",{class:!0,"data-svelte-h":!0}),at(x)!=="svelte-1f0jwh5"&&(x.textContent=b),N=Ee(Ne),O=Z(Ne,"BUTTON",{class:!0,"data-svelte-h":!0}),at(O)!=="svelte-1rbksk7"&&(O.textContent=$),Ne.forEach(Q),P=Ee(Fe),U=Z(Fe,"DIV",{class:!0});var Ke=fe(U);k.l(Ke),Ke.forEach(Q),Fe.forEach(Q),Ce.forEach(Q),X=Ee(Ae),V=Z(Ae,"FOOTER",{class:!0});var Ve=fe(V);z=Z(Ve,"DIV",{class:!0});var ot=fe(z);ne=Z(ot,"DIV",{class:!0,"data-svelte-h":!0}),at(ne)!=="svelte-5yc16o"&&(ne.innerHTML=_e),Y=Ee(ot),ee=Z(ot,"DIV",{class:!0});var ft=fe(ee);Ln(pe.$$.fragment,ft),ft.forEach(Q),ot.forEach(Q),oe=Ee(Ve),ue=Z(Ve,"DIV",{class:!0});var st=fe(ue);Pe=Z(st,"DIV",{class:!0,"data-svelte-h":!0}),at(Pe)!=="svelte-9i4ije"&&(Pe.innerHTML=Oe),Ue=Ee(st),He=Z(st,"DIV",{class:!0});var mt=fe(He);Ln(W.$$.fragment,mt),mt.forEach(Q),st.forEach(Q),lt=Ee(Ve),we=Z(Ve,"DIV",{class:!0});var Ut=fe(we);Re=Z(Ut,"DIV",{class:!0,"data-svelte-h":!0}),at(Re)!=="svelte-1v734fx"&&(Re.innerHTML=De),rt=Ee(Ut),Be=Z(Ut,"DIV",{class:!0});var Bi=fe(Be);Ln(A.$$.fragment,Bi),Bi.forEach(Q),Ut.forEach(Q),Ve.forEach(Q),Ae.forEach(Q),this.h()},h(){document.title="声学超材料逆向设计系统",H(s,"class","header-left svelte-251ly0"),H(l,"class","status-dot svelte-251ly0"),rn(l,"active",i[2]==="running"),H(u,"class","status-text svelte-251ly0"),H(o,"class","header-right svelte-251ly0"),H(n,"class","app-header svelte-251ly0"),H(m,"class","sidebar-left card svelte-251ly0"),H(d,"class","viewer-section card svelte-251ly0"),H(T,"class","btn btn-primary"),T.disabled=i[0],H(E,"class","actions-bar svelte-251ly0"),H(p,"class","center-panel svelte-251ly0"),H(x,"class","tab-btn svelte-251ly0"),rn(x,"active",i[1]==="optimization"),H(O,"class","tab-btn svelte-251ly0"),rn(O,"active",i[1]==="analysis"),H(L,"class","sidebar-tabs svelte-251ly0"),H(U,"class","sidebar-content svelte-251ly0"),rn(U,"optimization",i[1]==="optimization"),rn(U,"analysis",i[1]==="analysis"),H(y,"class","sidebar-right svelte-251ly0"),H(f,"class","app-main svelte-251ly0"),H(ne,"class","chart-header svelte-251ly0"),H(ee,"class","chart-content svelte-251ly0"),H(z,"class","footer-chart card svelte-251ly0"),H(Pe,"class","chart-header svelte-251ly0"),H(He,"class","chart-content svelte-251ly0"),H(ue,"class","footer-chart card svelte-251ly0"),H(Re,"class","chart-header svelte-251ly0"),H(Be,"class","chart-content svelte-251ly0"),H(we,"class","footer-chart card svelte-251ly0"),H(V,"class","app-footer svelte-251ly0"),H(t,"class","app-layout svelte-251ly0")},m(se,me){$e(se,e,me),$e(se,t,me),D(t,n),D(n,s),D(n,a),D(n,o),D(o,l),D(o,c),D(o,u),Te.m(u,null),D(t,h),D(t,f),D(f,m),Pn(_,m,null),D(f,g),D(f,p),D(p,d),Pn(M,d,null),D(p,v),D(p,E),D(E,T),Ie.m(T,null),D(f,w),D(f,y),D(y,L),D(L,x),D(L,N),D(L,O),D(y,P),D(y,U),ie[B].m(U,null),D(t,X),D(t,V),D(V,z),D(z,ne),D(z,Y),D(z,ee),Pn(pe,ee,null),D(V,oe),D(V,ue),D(ue,Pe),D(ue,Ue),D(ue,He),Pn(W,He,null),D(V,lt),D(V,we),D(we,Re),D(we,rt),D(we,Be),Pn(A,Be,null),S=!0,q||(ae=[Et(T,"click",i[3]),Et(x,"click",i[4]),Et(O,"click",i[5])],q=!0)},p(se,[me]){(!S||me&4)&&rn(l,"active",se[2]==="running"),ce!==(ce=le(se))&&(Te.d(1),Te=ce(se),Te&&(Te.c(),Te.m(u,null))),ge!==(ge=xe(se))&&(Ie.d(1),Ie=ge(se),Ie&&(Ie.c(),Ie.m(T,null))),(!S||me&1)&&(T.disabled=se[0]),(!S||me&2)&&rn(x,"active",se[1]==="optimization"),(!S||me&2)&&rn(O,"active",se[1]==="analysis");let Ae=B;B=ke(se),B!==Ae&&(sc(),an(ie[Ae],1,1,()=>{ie[Ae]=null}),nc(),k=ie[B],k||(k=ie[B]=Ge[B](se),k.c()),on(k,1),k.m(U,null)),(!S||me&2)&&rn(U,"optimization",se[1]==="optimization"),(!S||me&2)&&rn(U,"analysis",se[1]==="analysis")},i(se){S||(on(_.$$.fragment,se),on(M.$$.fragment,se),on(k),on(pe.$$.fragment,se),on(W.$$.fragment,se),on(A.$$.fragment,se),S=!0)},o(se){an(_.$$.fragment,se),an(M.$$.fragment,se),an(k),an(pe.$$.fragment,se),an(W.$$.fragment,se),an(A.$$.fragment,se),S=!1},d(se){se&&(Q(e),Q(t)),Te.d(),Cn(_),Cn(M),Ie.d(),ie[B].d(),Cn(pe),Cn(W),Cn(A),q=!1,Ws(ae)}}}function d_(i,e,t){let n,s,r,a;dt(i,Zo,f=>t(6,n=f)),dt(i,$r,f=>t(7,s=f)),dt(i,ym,f=>t(8,r=f)),dt(i,xn,f=>t(2,a=f));let o=!1,l="optimization";async function c(){t(0,o=!0);try{const f=await Om(r,{computeBandStructure:!0,computeTransmissionLoss:!0});f.band_structure&&ct($r,s=f.band_structure,s),f.transmission_loss&&ct(Zo,n=f.transmission_loss,n)}catch(f){console.error("Compute failed:",f)}finally{t(0,o=!1)}}return[o,l,a,c,()=>t(1,l="optimization"),()=>t(1,l="analysis")]}class g_ extends Hn{constructor(e){super(),kn(this,e,d_,f_,zn,{})}}export{g_ as component};
