varying vec2 vUv;
varying vec3 vPosition;
varying vec4 mvPosition;
varying vec3 vNormal;
uniform float time;

void main() {
	vUv = uv;
	
	vec3 p = position;

	vNormal = normal;
	mvPosition = modelViewMatrix * vec4(p,1.0);
	gl_Position = projectionMatrix * mvPosition;

	vPosition = p;
}
		
