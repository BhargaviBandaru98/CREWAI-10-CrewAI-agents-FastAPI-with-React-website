import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { BotProvider } from './context/BotContext'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ThemeProvider>
      <BotProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects/:slug" element={<ProjectPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </BotProvider>
    </ThemeProvider>
  )
}
