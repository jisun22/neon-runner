import { useEffect, useRef, useState } from 'react'

const W = 720
const H = 260
const GROUND = 210
const PX = 80
const PW = 34
const PH = 46
const PH_CROUCH = 20
const GRAVITY = 0.72
const JUMP_V = -13.5
const MAX_SPEED = 12.0   // 최대 속도 제한
const API = 'http://127.0.0.1:8000'

const STARS = Array.from({ length: 60 }, () => ({
  x: Math.random() * W,
  y: Math.random() * (GROUND - 20),
  r: Math.random() * 1.5 + 0.3,
  phase: Math.random() * Math.PI * 2,
}))

export default function App() {
  const canvasRef = useRef(null)
  const cleanupRef = useRef(null)
  const [screen, setScreen] = useState('game')
  const [finalScore, setFinalScore] = useState(0)
  const [finalTime, setFinalTime] = useState(0)
  const [nickname, setNickname] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [myRank, setMyRank] = useState(null)

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`${API}/leaderboard`)
      setLeaderboard(await res.json())
    } catch { setLeaderboard([]) }
  }

  async function submitScore() {
    if (!nickname.trim()) return
    try {
      const res = await fetch(`${API}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim().slice(0, 12),
          score: finalScore,
          time: finalTime,
        })
      })
      const data = await res.json()
      setMyRank(data.rank)
      await fetchLeaderboard()
      setScreen('leaderboard')
    } catch {
      alert('서버 연결 실패!')
    }
  }

  function startGame() {
    // 이전 게임 완전히 정리
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    setScreen('game')
    setMyRank(null)

    // canvas는 항상 DOM에 있으니 바로 사용 가능
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let tick = 0
    let animId
    let startTime = Date.now()
    let obstacles = []
    let nextObstacle = 100
    let isRunning = true

    const player = {
      x: PX,
      y: GROUND - PH,
      vy: 0,
      onGround: true,
      jumps: 0,
      crouching: false,
    }

    const keys = {}

    function jump() {
      if (keys['ArrowDown'] || keys['KeyS']) return
      if (player.jumps < 2) {
        player.vy = JUMP_V
        player.onGround = false
        player.jumps++
      }
    }

    const onKey = (e) => {
      if (!isRunning) return
      keys[e.code] = true
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
      }
    }

    const onKeyUp = (e) => {
      keys[e.code] = false
    }

    const onClick = () => {
      if (!isRunning) return
      jump()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('click', onClick)

    function cleanup() {
      isRunning = false
      cancelAnimationFrame(animId)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('click', onClick)
    }

    cleanupRef.current = cleanup

    function updatePlayer() {
      player.crouching = player.onGround && (keys['ArrowDown'] || keys['KeyS'])

      player.vy += GRAVITY
      player.y  += player.vy

      if (player.y >= GROUND - PH) {
        player.y = GROUND - PH
        player.vy = 0
        player.onGround = true
        player.jumps = 0
      }
    }

    function updateObstacles(speed, elapsed) {
      nextObstacle--
      if (nextObstacle <= 0) {
        const isFlying = Math.random() < 0.4

        if (isFlying) {
          const h = 22 + Math.random() * 14
          const w = 28 + Math.random() * 18
          const flyY = GROUND - PH - h - (Math.random() * 10)
          obstacles.push({
            x: W + 10, y: flyY, w, h,
            flying: true,
            type: Math.random() < 0.5 ? 'bird' : 'rock',
          })
        } else {
          const h = 28 + Math.random() * 36
          const w = 18 + Math.random() * 16
          obstacles.push({
            x: W + 10, y: GROUND - h, w, h,
            flying: false, type: 'block',
          })
        }

        const gap = Math.max(60, 115 - elapsed * 1.2)
        nextObstacle = gap + Math.random() * 50
      }

      obstacles = obstacles
        .map(o => ({ ...o, x: o.x - speed }))
        .filter(o => o.x > -80)
    }

    function checkCollision() {
      const margin = 6
      const ph = player.crouching ? PH_CROUCH : PH
      const py = player.crouching ? GROUND - PH_CROUCH : player.y

      for (const o of obstacles) {
        if (
          player.x + PW - margin > o.x + margin &&
          player.x + margin < o.x + o.w - margin &&
          py + ph - margin > o.y + margin &&
          py + margin < o.y + o.h - margin
        ) return true
      }
      return false
    }

    function drawBackground() {
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
      sky.addColorStop(0, '#04040f')
      sky.addColorStop(1, '#0c0c28')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, GROUND)

      STARS.forEach(s => {
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(tick * 0.02 + s.phase))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(190,210,255,${alpha})`
        ctx.fill()
      })

      ctx.fillStyle = '#050f08'
      ctx.fillRect(0, GROUND, W, H - GROUND)

      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = 2
      ctx.shadowBlur = 12
      ctx.shadowColor = '#00ff88'
      ctx.beginPath()
      ctx.moveTo(0, GROUND)
      ctx.lineTo(W, GROUND)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    function drawObstacles() {
      obstacles.forEach(o => {
        ctx.save()
        if (o.type === 'bird') {
          ctx.shadowBlur = 12
          ctx.shadowColor = '#ffcc00'
          ctx.fillStyle = '#ffcc00'
          ctx.fillRect(o.x, o.y, o.w, o.h)
          ctx.fillStyle = '#ff9900'
          ctx.fillRect(o.x, o.y, o.w, o.h / 3)
          ctx.fillStyle = '#ff6600'
          ctx.fillRect(o.x + o.w, o.y + o.h / 3, 8, 6)
          ctx.fillStyle = '#000'
          ctx.fillRect(o.x + o.w - 8, o.y + 4, 5, 5)
        } else if (o.type === 'rock') {
          ctx.shadowBlur = 12
          ctx.shadowColor = '#cc44ff'
          ctx.fillStyle = '#9933cc'
          ctx.beginPath()
          ctx.moveTo(o.x + 6,  o.y)
          ctx.lineTo(o.x + o.w - 4, o.y + 2)
          ctx.lineTo(o.x + o.w, o.y + o.h - 4)
          ctx.lineTo(o.x + o.w - 6, o.y + o.h)
          ctx.lineTo(o.x + 3, o.y + o.h - 2)
          ctx.lineTo(o.x, o.y + 5)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.fillRect(o.x + 6, o.y + 4, 8, 4)
        } else {
          ctx.shadowBlur = 14
          ctx.shadowColor = '#ff3300'
          ctx.fillStyle = '#ff3300'
          ctx.fillRect(o.x, o.y, o.w, o.h)
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 5)
        }
        ctx.restore()
      })
    }

    function drawPlayer() {
      const crouching = player.crouching
      const x = player.x
      const ph = crouching ? PH_CROUCH : PH
      const y  = GROUND - ph
      const legL = player.onGround && !crouching ? Math.sin(tick * 0.2) * 5 : 0
      const legR = player.onGround && !crouching ? Math.cos(tick * 0.2) * 5 : 0

      ctx.save()
      ctx.shadowBlur = 20
      ctx.shadowColor = '#00eeff'
      ctx.fillStyle = '#00eeff'
      ctx.fillRect(x, y, PW, ph)

      if (!crouching) {
        ctx.fillStyle = '#001122'
        ctx.fillRect(x + 6, y + 8, 22, 14)
        ctx.fillStyle = 'rgba(0,240,255,0.5)'
        ctx.fillRect(x + 7, y + 9, 20, 12)
        ctx.fillStyle = '#009aaa'
        ctx.fillRect(x + 4,  y + PH, 12, 8 + legL)
        ctx.fillRect(x + 18, y + PH, 12, 8 + legR)
      } else {
        ctx.fillStyle = '#001122'
        ctx.fillRect(x + 4, y + 4, 26, 10)
        ctx.fillStyle = 'rgba(0,240,255,0.5)'
        ctx.fillRect(x + 5, y + 5, 24, 8)
      }
      ctx.restore()
    }

    function drawHUD(score, speed, elapsed) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, W, 36)
      ctx.shadowBlur = 8
      ctx.font = 'bold 13px monospace'
      ctx.shadowColor = '#00ff88'
      ctx.fillStyle = '#00ff88'
      ctx.fillText(`⏱ ${elapsed.toFixed(1)}s`, 14, 23)
      ctx.shadowColor = '#ffdd00'
      ctx.fillStyle = '#ffdd00'
      ctx.fillText(`★ ${score}`, 140, 23)
      ctx.shadowColor = '#ff88ff'
      ctx.fillStyle = '#ff88ff'
      ctx.fillText(`⚡ ${speed.toFixed(1)}x`, 260, 23)

      // 최대 속도 도달 시 표시
      if (speed >= MAX_SPEED) {
        ctx.shadowColor = '#ff0000'
        ctx.fillStyle = '#ff0000'
        ctx.fillText('MAX SPEED!', 360, 23)
      }

      ctx.shadowBlur = 0

      if (elapsed < 5) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = '11px monospace'
        ctx.textAlign = 'right'
        ctx.fillText('↑/SPACE 점프  ↓/S 엎드리기', W - 14, 23)
        ctx.textAlign = 'left'
      }
    }

    function loop() {
      tick++
      const elapsed = (Date.now() - startTime) / 1000
      // 속도: 서서히 증가하다 MAX_SPEED에서 고정
      const speed = Math.min(MAX_SPEED, 3.0 + elapsed * 0.1 + (elapsed / 30) * 0.8)
      const score = Math.floor(elapsed * 10)

      ctx.clearRect(0, 0, W, H)
      updatePlayer()
      updateObstacles(speed, elapsed)

      if (checkCollision()) {
        cleanup()
        setFinalScore(score)
        setFinalTime(parseFloat(elapsed.toFixed(1)))
        setScreen('gameover')
        return
      }

      drawBackground()
      drawObstacles()
      drawPlayer()
      drawHUD(score, speed, elapsed)
      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
  }

  useEffect(() => {
    startGame()
    fetchLeaderboard()
  }, [])

  const s = {
    root: {
      background: '#000',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      color: '#fff',
      gap: '16px',
    },
    btn: (color = '#00ff88') => ({
      background: 'transparent',
      border: `2px solid ${color}`,
      color,
      padding: '10px 28px',
      fontFamily: 'monospace',
      fontSize: '14px',
      fontWeight: 'bold',
      letterSpacing: '0.1em',
      cursor: 'pointer',
    }),
    input: {
      background: 'transparent',
      border: '2px solid #00ff88',
      color: '#00ff88',
      padding: '10px 16px',
      fontFamily: 'monospace',
      fontSize: '16px',
      letterSpacing: '0.15em',
      outline: 'none',
      textAlign: 'center',
      width: '220px',
      textTransform: 'uppercase',
    },
    // canvas는 항상 렌더되고 위에 오버레이를 올림
    overlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
      zIndex: 10,
    }
  }

  return (
    <div style={s.root}>
      {/* canvas 항상 고정 */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          border: '2px solid #00ff88',
          boxShadow: '0 0 30px #00ff8844',
          cursor: 'pointer',
          position: screen === 'game' ? 'relative' : 'fixed',
          top: screen === 'game' ? 'auto' : '-9999px',
        }}
      />

      {screen === 'game' && (
        <div style={{ color: '#444', fontSize: '12px', letterSpacing: '0.15em' }}>
          ↑ / SPACE 점프 &nbsp;·&nbsp; ↓ / S 엎드리기 &nbsp;·&nbsp; 더블점프 가능
        </div>
      )}

      {/* 게임오버 오버레이 */}
      {screen === 'gameover' && (
        <div style={s.overlay}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ff4444', textShadow: '0 0 20px #ff4444', marginBottom: '8px' }}>
              💥 GAME OVER
            </div>
            <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', margin: '20px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '11px', letterSpacing: '0.2em' }}>SCORE</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ffdd00', textShadow: '0 0 12px #ffdd00' }}>{finalScore}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '11px', letterSpacing: '0.2em' }}>TIME</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#00eeff', textShadow: '0 0 12px #00eeff' }}>{finalTime}s</div>
              </div>
            </div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px', letterSpacing: '0.15em' }}>닉네임 입력 후 점수 등록</div>
            <input
              style={s.input}
              placeholder="NICKNAME"
              maxLength={12}
              value={nickname}
              onChange={e => setNickname(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && submitScore()}
              autoFocus
            />
            <br /><br />
            <button style={s.btn('#ffdd00')} onClick={submitScore}>★ 점수 등록</button>
            &nbsp;&nbsp;
            <button style={s.btn()} onClick={startGame}>▶ 다시하기</button>
          </div>
        </div>
      )}

      {/* 리더보드 오버레이 */}
      {screen === 'leaderboard' && (
        <div style={s.overlay}>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ffdd00', textShadow: '0 0 12px #ffdd00', letterSpacing: '0.15em', marginBottom: '8px' }}>
            ★ LEADERBOARD ★
          </div>
          {myRank && <div style={{ color: '#00ff88', fontSize: '14px', marginBottom: '12px' }}>🏆 내 순위: #{myRank}</div>}
          <div style={{ width: '480px', marginBottom: '16px' }}>
            {leaderboard.slice(0, 10).map((e, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center',
                padding: '8px 14px', marginBottom: '4px',
                background: i < 3 ? 'rgba(255,221,0,0.07)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#333'}`,
                borderRadius: '4px',
              }}>
                <div style={{ width: '32px', color: '#ffdd00', fontWeight: 'bold' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </div>
                <div style={{ flex: 1, color: '#fff', fontWeight: 'bold' }}>{e.nickname}</div>
                <div style={{ color: '#ffdd00', marginRight: '16px' }}>{e.score}pt</div>
                <div style={{ color: '#00eeff', marginRight: '16px' }}>{e.time}s</div>
                <div style={{ color: '#444', fontSize: '11px' }}>{e.date}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={s.btn()} onClick={startGame}>▶ 다시하기</button>
            <button style={s.btn('#888')} onClick={() => { fetchLeaderboard(); setScreen('leaderboard') }}>🔄 새로고침</button>
          </div>
        </div>
      )}
    </div>
  )
}