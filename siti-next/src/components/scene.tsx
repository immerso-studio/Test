'use client'

import React, { useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useLoader } from '@react-three/fiber'
import { MeshTransmissionMaterial, Environment, Text } from '@react-three/drei'
import { TextureLoader } from 'three'

function BackgroundImage() {
  const texture = useLoader(TextureLoader, '/images/sfondo-2.jpg')

  return (
    <mesh position={[0, 0, -10]}>
      <planeGeometry args={[32, 18]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

function GlassSphere() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [dragging, setDragging] = React.useState(false)

  const handlePointerDown = () => setDragging(true)
  const handlePointerUp = () => setDragging(false)

  const handlePointerMove = (e: any) => {
    if (dragging && meshRef.current) {
      // Coordinate 3D sotto il mouse
      const point = e.point
      meshRef.current.position.x = point.x
      meshRef.current.position.y = point.y
    }
  }

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <sphereGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        transmission={1}
        roughness={0.1}
        thickness={1}
        ior={1.6}
        chromaticAberration={0.1}
        backside={true}
      />
    </mesh>

  )
}


export default function Scene() {
  return (
    <Canvas style={{ background: 'black' }} camera={{ position: [0, 0, 5] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <Environment preset="night" />

      {/* Immagine di sfondo */}
      <BackgroundImage />

      {/* Sfera vetro */}
      <GlassSphere />




    </Canvas>
  )
}
