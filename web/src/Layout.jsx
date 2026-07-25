import { Outlet, useLocation } from 'react-router-dom';
import { Header, Footer } from './components';
import { Toaster } from '@/components/ui/sonner';

// Pages that should NOT show the global footer
const NO_FOOTER_ROUTES = ['/query'];

function Layout() {
    const { pathname } = useLocation();
    const showFooter = !NO_FOOTER_ROUTES.includes(pathname);

    return (
        <>
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 flex flex-col">
                    <Outlet />
                </main>
            </div>
            {showFooter && <Footer />}
        </>
    );
}

export default Layout;
