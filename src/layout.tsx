import './globals.css'

export const metadata = {
  title: 'Sport Radar',
  description: 'AI Football Predictions'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  )
}
