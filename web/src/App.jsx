import { Home, About, NotFound, Query, Login, Register, Ingest, Documents } from './pages';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ThemeProvider } from "@/components/theme-provider";
import Layout from './Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                path: '',
                element: <Home />,
            },
            {
                path: 'ingest',
                element: (
                    <ProtectedRoute requireAdmin={true}>
                        <Ingest />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'documents',
                element: (
                    <ProtectedRoute requireAdmin={true}>
                        <Documents />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'query',
                element: (
                    <ProtectedRoute>
                        <Query />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'query/:chatId',
                element: (
                    <ProtectedRoute>
                        <Query />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'login',
                element: <Login />,
            },
            {
                path: 'register',
                element: <Register />,
            },
            {
                path: 'about',
                element: <About />,
            },
            {
                path: '*',
                element: <NotFound />,
            },
        ],
    },
]);

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <ErrorBoundary>
                <RouterProvider router={router} />
            </ErrorBoundary>
        </ThemeProvider>
    );
}

export default App;
