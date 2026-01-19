/**
 * ScoreGauge Component
 * 
 * Visual circular gauge displaying SEO score with color-coded status.
 * Production-ready with smooth animations and accessible design.
 */

import { useEffect, useState } from 'react'
import { getScoreLevel, getScoreColors } from '../../types/seo'

interface ScoreGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  showLabel?: boolean
  animated?: boolean
}

const sizeConfig = {
  sm: { diameter: 60, strokeWidth: 6, fontSize: 16, labelSize: 10 },
  md: { diameter: 100, strokeWidth: 8, fontSize: 24, labelSize: 12 },
  lg: { diameter: 140, strokeWidth: 10, fontSize: 32, labelSize: 14 },
}

export default function ScoreGauge({
  score,
  size = 'md',
  label,
  showLabel = true,
  animated = true,
}: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(animated ? 0 : score)
  const config = sizeConfig[size]
  const colors = getScoreColors(score)
  const level = getScoreLevel(score)
  
  const radius = (config.diameter - config.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (animatedScore / 100) * circumference
  const offset = circumference - progress
  
  // Animate score on mount with proper cleanup
  useEffect(() => {
    if (!animated) {
      setAnimatedScore(score)
      return
    }
    
    let animationFrameId: number
    let isMounted = true
    
    const duration = 1000 // ms
    const startTime = performance.now()
    const startScore = 0
    
    function animate(currentTime: number) {
      if (!isMounted) return
      
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentScore = Math.round(startScore + (score - startScore) * eased)
      
      setAnimatedScore(currentScore)
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }
    
    animationFrameId = requestAnimationFrame(animate)
    
    // Cleanup: cancel animation on unmount
    return () => {
      isMounted = false
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [score, animated])
  
  const levelLabels = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Needs Work',
  }
  
  return (
    <div className="seo-score-gauge" style={{ 
      display: 'inline-flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '8px',
    }}>
      <div style={{ position: 'relative', width: config.diameter, height: config.diameter }}>
        <svg
          width={config.diameter}
          height={config.diameter}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background circle */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="var(--gray-200)"
            strokeWidth={config.strokeWidth}
          />
          
          {/* Progress circle */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={colors.text}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: animated ? 'stroke-dashoffset 0.3s ease-out' : 'none',
            }}
          />
        </svg>
        
        {/* Score text in center */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <span style={{
            fontSize: config.fontSize,
            fontWeight: 700,
            color: colors.text,
            lineHeight: 1,
          }}>
            {animatedScore}
          </span>
          {size !== 'sm' && (
            <span style={{
              fontSize: config.labelSize,
              color: 'var(--gray-500)',
              marginLeft: '2px',
            }}>
              /100
            </span>
          )}
        </div>
      </div>
      
      {/* Label below gauge */}
      {showLabel && (
        <div style={{ textAlign: 'center' }}>
          {label && (
            <div style={{
              fontSize: config.labelSize,
              color: 'var(--gray-600)',
              fontWeight: 500,
            }}>
              {label}
            </div>
          )}
          <div style={{
            fontSize: config.labelSize,
            color: colors.text,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {levelLabels[level]}
          </div>
        </div>
      )}
    </div>
  )
}
