import React, { useMemo } from 'react'

function makeStars(count) {
  const stars = []
  let seed = 42
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < count; i++) {
    stars.push({
      left: `${(rand() * 100).toFixed(2)}%`,
      top: `${(rand() * 100).toFixed(2)}%`,
      size: rand() < 0.8 ? 2 : 3,
      delay: `${(rand() * 4).toFixed(2)}s`,
      duration: `${(2.5 + rand() * 3).toFixed(2)}s`,
      opacity: (0.4 + rand() * 0.6).toFixed(2),
    })
  }
  return stars
}

const Starfield = () => {
  const stars = useMemo(() => makeStars(90), [])
  return (
    <div className="starfield" aria-hidden="true">
      <div className="nebula nebulaOne" />
      <div className="nebula nebulaTwo" />
      <div className="nebula nebulaThree" />
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
            opacity: s.opacity,
          }}
        />
      ))}
      <span className="shootingStar" />
      <span className="shootingStar shootingStarTwo" />
    </div>
  )
}

export default Starfield
