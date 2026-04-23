import { useEffect, useRef, useState } from 'react'

const W = 720, H = 260, GROUND = 210
const PX = 80, PW = 34, PH = 46, PH_CROUCH = 20
const GRAVITY = 0.72, JUMP_V = -13.5, MAX_SPEED = 10.0
const API = 'http://127.0.0.1:8000'

const STARS = Array.from({ length: 60 }, () => ({
  x: Math.random() * W,
  y: Math.random() * (GROUND - 20),
  r: Math.random() * 1.5 + 0.3,
  phase: Math.random() * Math.PI * 2,
}))

// 게임 루프 ID — 모듈 전역으로 관리 (중복 실행 방지)
let gAnimId = null
let gRunning = false

export default function App() {
  const canvasRef = useRef(null)
  const [screen, setScreen] = useState('start')
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

      // 중복 닉네임이면 알림
      if (data.duplicate) {
        alert('❌ 이미 존재하는 닉네임이에요!\n다른 닉네임을 입력해주세요.')
        return
      }

      setMyRank(data.rank)
      await fetchLeaderboard()
      setScreen('leaderboard')
    } catch { alert('서버 연결 실패!') }
  }

  function startGame() {
    // 기존 루프 강제 종료
    gRunning = false
    if (gAnimId) {
      cancelAnimationFrame(gAnimId)
      gAnimId = null
    }

    setScreen('game')
    setMyRank(null)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // 게임 상태
    let tick = 0
    let startTime = Date.now()
    let obstacles = []
    let nextObstacle = 100

    const player = {
      x: PX, y: GROUND - PH,
      vy: 0, onGround: true,
      jumps: 0, crouching: false,
    }

    const keys = {}

    // 이벤트 핸들러
    function onKeyDown(e) {
      keys[e.code] = true
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        doJump()
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
      }
    }
    function onKeyUp(e) { keys[e.code] = false }
    function onClickCanvas() { doJump() }

    function doJump() {
      if (keys['ArrowDown'] || keys['KeyS']) return
      if (player.jumps < 2) {
        player.vy = JUMP_V
        player.onGround = false
        player.jumps++
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('click', onClickCanvas)

    function removeListeners() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('click', onClickCanvas)
    }

    function updatePlayer() {
      player.crouching = player.onGround &&
        !!(keys['ArrowDown'] || keys['KeyS'])

      player.vy += GRAVITY
      player.y += player.vy

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
      if (Math.random() < 0.4) {
        const w = 40 + Math.random() * 20
        // 위에서부터 엎드린 높이 바로 위까지 내려오는 천장형 장애물
        const obstacleBottom = GROUND - PH_CROUCH - 5
        const h = obstacleBottom  // 화면 위에서부터 내려옴
        obstacles.push({
          x: W + 10,
          y: 0,  // 화면 맨 위부터 시작
          w, h, type: Math.random() < 0.5 ? 'bird' : 'rock'
        })
      }else {
          const h = 28 + Math.random() * 36
          const w = 18 + Math.random() * 16
          obstacles.push({ x: W + 10, y: GROUND - h, w, h, type: 'block' })
        }
        nextObstacle = Math.max(60, 115 - elapsed * 1.2) + Math.random() * 50
      }
      obstacles = obstacles
        .map(o => ({ ...o, x: o.x - speed }))
        .filter(o => o.x > -80)
    }

    function checkCollision() {
      const margin = 4
      const ph = player.crouching ? PH_CROUCH : PH
      const py = player.crouching ? GROUND - PH_CROUCH : player.y

      for (const o of obstacles) {
        // 날아오는 장애물은 엎드리면 무조건 통과
        if (o.type === 'bird' || o.type === 'rock') {
          if (player.crouching) continue
        }

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
        const a = 0.3 + 0.7 * Math.abs(Math.sin(tick * 0.02 + s.phase))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(190,210,255,${a})`
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
          ctx.moveTo(o.x + 6, o.y)
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
      const ph = player.crouching ? PH_CROUCH : PH
      const y = player.crouching ? GROUND - PH_CROUCH : player.y
      const legL = player.onGround && !player.crouching ? Math.sin(tick * 0.2) * 5 : 0
      const legR = player.onGround && !player.crouching ? Math.cos(tick * 0.2) * 5 : 0

      ctx.save()
      ctx.shadowBlur = 20
      ctx.shadowColor = '#00eeff'
      ctx.fillStyle = '#00eeff'
      ctx.fillRect(player.x, y, PW, ph)
      if (!player.crouching) {
        ctx.fillStyle = '#001122'
        ctx.fillRect(player.x + 6, y + 8, 22, 14)
        ctx.fillStyle = 'rgba(0,240,255,0.5)'
        ctx.fillRect(player.x + 7, y + 9, 20, 12)
        ctx.fillStyle = '#009aaa'
        ctx.fillRect(player.x + 4,  y + PH, 12, 8 + legL)
        ctx.fillRect(player.x + 18, y + PH, 12, 8 + legR)
      } else {
        ctx.fillStyle = '#001122'
        ctx.fillRect(player.x + 4, y + 4, 26, 10)
        ctx.fillStyle = 'rgba(0,240,255,0.5)'
        ctx.fillRect(player.x + 5, y + 5, 24, 8)
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
      if (speed >= MAX_SPEED) {
        ctx.shadowColor = '#ff0000'
        ctx.fillStyle = '#ff0000'
        ctx.fillText('MAX!', 360, 23)
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

    // 루프 시작
    gRunning = true

    function loop() {
      // 이 루프가 살아있어야 할 루프인지 체크
      if (!gRunning) return

      tick++
      const elapsed = (Date.now() - startTime) / 1000
      const speed = Math.min(MAX_SPEED, 2.8 + Math.sqrt(elapsed) * 0.3)
      const score = Math.floor(elapsed * 10)

      ctx.clearRect(0, 0, W, H)
      updatePlayer()
      updateObstacles(speed, elapsed)

      if (checkCollision()) {
        gRunning = false
        removeListeners()
        setFinalScore(score)
        setFinalTime(parseFloat(elapsed.toFixed(1)))
        setScreen('gameover')
        return
      }

      drawBackground()
      drawObstacles()
      drawPlayer()
      drawHUD(score, speed, elapsed)

      gAnimId = requestAnimationFrame(loop)
    }

    gAnimId = requestAnimationFrame(loop)
  }

 useEffect(() => {
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
      gap: '12px',
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
  }

  return (
    <div style={s.root}>
      {screen === 'start' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '20px', zIndex: 20,
        }}>
          {/* 타이틀 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#00ff88',
              textShadow: '0 0 30px #00ff88, 0 0 60px #00ff8844', letterSpacing: '0.15em' }}>
              NEON RUNNER
            </div>
            <div style={{ color: '#555', fontSize: '12px', letterSpacing: '0.2em', marginTop: '6px' }}>
              SURVIVE · SCORE · DOMINATE
            </div>
          </div>

          {/* 게임 설명 */}
          <div style={{
            background: 'rgba(0,255,136,0.05)',
            border: '1px solid #00ff8833',
            borderRadius: '8px',
            padding: '20px 32px',
            fontSize: '13px',
            color: '#aaa',
            lineHeight: '2',
            textAlign: 'center',
          }}>
            <div style={{ color: '#00ff88', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
              조작법
            </div>
            <div>⬆ / <span style={{ color: '#fff' }}>SPACE</span> &nbsp;—&nbsp; 점프 (더블점프 가능)</div>
            <div>⬇ / <span style={{ color: '#fff' }}>S</span> &nbsp;—&nbsp; 엎드리기</div>
            <div style={{ marginTop: '12px', color: '#555' }}>────────────────</div>
            <div style={{ marginTop: '12px' }}>
              🟥 빨간 블록 &nbsp;—&nbsp; <span style={{ color: '#fff' }}>점프</span>로 피하기
            </div>
            <div>
              🟡 노란 새 &nbsp;—&nbsp; <span style={{ color: '#fff' }}>엎드려서</span> 피하기
            </div>
            <div>
              🟣 보라 돌멩이 &nbsp;—&nbsp; <span style={{ color: '#fff' }}>엎드려서</span> 피하기
            </div>
            <div style={{ marginTop: '12px', color: '#555' }}>────────────────</div>
            <div style={{ marginTop: '12px' }}>
              ⚡ 시간이 지날수록 <span style={{ color: '#ff88ff' }}>속도가 빨라져요!</span>
            </div>
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={{
                background: 'transparent',
                border: '2px solid #00ff88',
                color: '#00ff88',
                padding: '14px 40px',
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: 'bold',
                letterSpacing: '0.15em',
                cursor: 'pointer',
                textShadow: '0 0 10px #00ff88',
                boxShadow: '0 0 20px #00ff8833',
              }}
              onClick={startGame}
            >
              ▶ GAME START
            </button>
            <button
              style={{
                background: 'transparent',
                border: '2px solid #ffdd00',
                color: '#ffdd00',
                padding: '14px 28px',
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: 'bold',
                letterSpacing: '0.15em',
                cursor: 'pointer',
              }}
              onClick={() => { fetchLeaderboard(); setScreen('leaderboard') }}
            >
              ★ 순위표
            </button>
          </div>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            display: 'block',
            border: '2px solid #00ff88',
            boxShadow: '0 0 30px #00ff8844',
            cursor: 'pointer',
          }}
        />

        {screen === 'gameover' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: '34px', fontWeight: 'bold', color: '#ff4444', textShadow: '0 0 20px #ff4444', marginBottom: '8px' }}>
              💥 GAME OVER
            </div>
            <div style={{ display: 'flex', gap: '40px', margin: '16px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '11px', letterSpacing: '0.2em' }}>SCORE</div>
                <div style={{ fontSize: '34px', fontWeight: 'bold', color: '#ffdd00', textShadow: '0 0 12px #ffdd00' }}>{finalScore}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#555', fontSize: '11px', letterSpacing: '0.2em' }}>TIME</div>
                <div style={{ fontSize: '34px', fontWeight: 'bold', color: '#00eeff', textShadow: '0 0 12px #00eeff' }}>{finalTime}s</div>
              </div>
            </div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>닉네임 입력 후 점수 등록</div>
            <input
              style={s.input}
              placeholder="NICKNAME"
              maxLength={12}
              value={nickname}
              onChange={e => setNickname(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && submitScore()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button style={s.btn('#ffdd00')} onClick={submitScore}>★ 점수 등록</button>
              <button style={s.btn()} onClick={startGame}>▶ 다시하기</button>
            </div>
          </div>
        )}

        {screen === 'leaderboard' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffdd00', textShadow: '0 0 12px #ffdd00', marginBottom: '8px' }}>
              ★ LEADERBOARD ★
            </div>
            {myRank && (
              <div style={{ color: '#00ff88', fontSize: '13px', marginBottom: '10px' }}>
                🏆 내 순위: #{myRank}
              </div>
            )}
            <div style={{ width: '90%', marginBottom: '12px' }}>
              {leaderboard.slice(0, 10).map((e, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center',
                  padding: '6px 12px', marginBottom: '3px',
                  background: i < 3 ? 'rgba(255,221,0,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#333'}`,
                  borderRadius: '4px',
                }}>
                  <div style={{ width: '28px', color: '#ffdd00', fontWeight: 'bold' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </div>
                  <div style={{ flex: 1, color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>{e.nickname}</div>
                  <div style={{ color: '#ffdd00', marginRight: '12px', fontSize: '13px' }}>{e.score}pt</div>
                  <div style={{ color: '#00eeff', marginRight: '12px', fontSize: '13px' }}>{e.time}s</div>
                  <div style={{ color: '#444', fontSize: '11px' }}>{e.date}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={s.btn()} onClick={startGame}>▶ 다시하기</button>
              <button style={s.btn('#888')} onClick={() => { fetchLeaderboard(); setScreen('leaderboard') }}>🔄 새로고침</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ color: '#444', fontSize: '12px', letterSpacing: '0.15em' }}>
        ↑ / SPACE 점프 &nbsp;·&nbsp; ↓ / S 엎드리기 &nbsp;·&nbsp; 더블점프 가능
      </div>
    </div>
  )
}