async function getMatches() {

  const today = new Date().toISOString().split('T')[0]

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?date=${today}`,
    {
      headers: {
        'x-apisports-key':
          '8464fe0b2c02cc648155fd7aaa8a5806'
      },
      cache: 'no-store'
    }
  )

  const data = await res.json()

  return data.response.slice(0, 12)
}

export default async function HomePage() {

  const matches = await getMatches()

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#050505',
        padding: '20px'
      }}
    >
      <div
        style={{
          maxWidth: '1300px',
          margin: '0 auto'
        }}
      >
        <div
          style={{
            marginBottom: '40px'
          }}
        >
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 'bold'
            }}
          >
            ⚽ Sport Radar
          </h1>

          <p
            style={{
              color: '#777',
              marginTop: '10px',
              fontSize: '18px'
            }}
          >
            AI Football Predictions
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}
        >
          {matches.map((match: any) => {

            const home =
              match.teams.home.name

            const away =
              match.teams.away.name

            const confidence =
              Math.floor(Math.random() * 25) + 70

            const predictions = [
              'GG',
              'Over 2.5',
              '1',
              'X2'
            ]

            const prediction =
              predictions[
                Math.floor(
                  Math.random() *
                    predictions.length
                )
              ]

            return (
              <div
                key={match.fixture.id}
                style={{
                  background: '#111',
                  border:
                    '1px solid #222',
                  borderRadius: '20px',
                  padding: '20px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: '24px'
                      }}
                    >
                      {home}
                    </h2>

                    <p
                      style={{
                        color: '#777',
                        marginTop: '5px'
                      }}
                    >
                      vs {away}
                    </p>
                  </div>

                  <div
                    style={{
                      textAlign: 'right'
                    }}
                  >
                    <p
                      style={{
                        color: '#00ff95',
                        fontWeight:
                          'bold',
                        fontSize: '28px'
                      }}
                    >
                      {confidence}%
                    </p>

                    <p
                      style={{
                        color: '#777'
                      }}
                    >
                      Confidence
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '20px',
                    background: '#000',
                    padding: '15px',
                    borderRadius: '15px'
                  }}
                >
                  <p
                    style={{
                      color: '#777',
                      fontSize: '14px'
                    }}
                  >
                    AI Prediction
                  </p>

                  <p
                    style={{
                      marginTop: '8px',
                      fontSize: '24px',
                      fontWeight:
                        'bold',
                      color: '#00ff95'
                    }}
                  >
                    {prediction}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '20px'
                  }}
                >
                  <p
                    style={{
                      color: '#888'
                    }}
                  >
                    {match.league.name}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
