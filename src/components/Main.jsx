import React, { useEffect, useState } from 'react'

const Main = (props) => {
  const { data } = props
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const [imgSrc, setImgSrc] = useState('')
  const isVideo = data?.media_type === 'video'
  const videoUrl = data?.url
  const imageUrl = data?.hdurl || data?.url
  const isLogoOnly = typeof imageUrl === 'string' && imageUrl.includes('nasa-logo')
  const normalizedEmbedUrl =
    typeof videoUrl === 'string' && videoUrl.includes('youtu.be/')
      ? videoUrl.replace('youtu.be/', 'www.youtube.com/embed/')
      : typeof videoUrl === 'string' && videoUrl.includes('youtube.com/watch?v=')
        ? videoUrl.replace('watch?v=', 'embed/')
        : videoUrl
  const isEmbeddableVideo =
    typeof normalizedEmbedUrl === 'string' &&
    (normalizedEmbedUrl.includes('youtube.com') ||
      normalizedEmbedUrl.includes('youtu.be') ||
      normalizedEmbedUrl.includes('vimeo.com'))

  useEffect(() => {
    setImgLoaded(false)
    setImgFailed(false)
    setImgSrc(imageUrl)
  }, [imageUrl])

  function handleImgError() {
    if (data?.altUrl && imgSrc !== data.altUrl) {
      setImgSrc(data.altUrl)
      return
    }
    setImgFailed(true)
  }

  if (isLogoOnly && !isVideo) {
    return (
      <div className="imgContainer logoPlaceholder">
        <span className="mediaTypeBadge">IMAGE</span>
        <div className="logoSky">
          <span className="logoMoon">🌙</span>
          <span className="logoStar">✦</span>
          <span className="logoStar logoStarTwo">✦</span>
          <span className="logoStar logoStarThree">✦</span>
          <p className="logoText">NASA did not publish a photo for this date.</p>
          <p className="logoSub">Try Surprise me or pick another date for a real space photo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="imgContainer">
      <span className="mediaTypeBadge">{isVideo ? 'VIDEO' : 'IMAGE'}</span>
      {!imgLoaded && !isVideo && !imgFailed && <div className="mediaSkeleton"><span className="skeletonStar">✦</span><p>Loading image...</p></div>}
      {imgFailed && !isVideo && (
        <div className="mediaSkeleton">
          <span className="skeletonStar">✦</span>
          <p>That image would not load from NASA right now. The title and story above are still from NASA, try another date.</p>
        </div>
      )}
      {isVideo ? (
        isEmbeddableVideo ? (
          <iframe
            src={normalizedEmbedUrl}
            title={data?.title || 'nasa-apod-video'}
            className="bgVideoFrame"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <video
            src={videoUrl}
            className="bgVideo"
            controls
            preload="metadata"
          />
        )
      ) : imgFailed ? null : (
        <img
          src={imgSrc || imageUrl}
          alt={data?.title || 'bg-img'}
          className={`bgImage ${imgLoaded ? 'imgLoaded' : 'imgLoading'}`}
          onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
        />
      )}
    </div>
  )
}

export default Main
