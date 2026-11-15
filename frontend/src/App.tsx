import AppBar from '@mui/material/AppBar'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Container from '@mui/material/Container'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'

// 仮の最初の画面（環境構築の確認用）。タイムラインなどの本物の画面は、機能ごとに作る
export default function App() {
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="h1">
            RaiseTimeLine
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="body1">画面の土台ができました。これから、機能ごとに画面を作ります。</Typography>
          </CardContent>
        </Card>
      </Container>
    </>
  )
}
