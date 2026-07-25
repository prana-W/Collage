import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card className="border-destructive/30 bg-destructive/5 text-card-foreground text-center shadow-lg">
          <CardHeader className="space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              Access Restricted to Institute Admins
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              PDF document ingestion is restricted to administrators only. You are currently logged in as <span className="font-semibold text-foreground">{user?.email}</span> (Student/User role).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => window.location.href = '/query'}
              className="bg-primary text-primary-foreground font-medium"
            >
              Go to Query Assistant
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
