import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, Building2, User, Mail, Lock, Loader2, AlertCircle, Shield, GraduationCap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Register = () => {
  const { registerAdmin, registerUser } = useAuth();
  const navigate = useNavigate();

  const [roleTab, setRoleTab] = useState('user'); // 'user' or 'admin'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [collegeSlug, setCollegeSlug] = useState('nitjsr');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      if (roleTab === 'admin') {
        if (!collegeName.trim()) {
          throw new Error('Please specify the college name.');
        }
        await registerAdmin({
          name: name.trim(),
          email: email.trim(),
          password,
          college_name: collegeName.trim(),
        });
        navigate('/'); // Admins go to PDF ingestion
      } else {
        if (!collegeSlug.trim()) {
          throw new Error('Please specify the college slug.');
        }
        await registerUser({
          name: name.trim(),
          email: email.trim(),
          password,
          college_slug: collegeSlug.trim().toLowerCase(),
        });
        navigate('/query'); // Regular users go to RAG assistant
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto py-10 px-4 flex flex-col justify-center min-h-[calc(100vh-10rem)]">
      <Card className="border-border/60 shadow-xl bg-card text-card-foreground">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
            <UserPlus className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Create Account
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            Join the UniRAG portal as a Student/User or an Institute Admin.
          </CardDescription>

          {/* Role Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl mt-4 border border-border/50">
            <button
              type="button"
              onClick={() => {
                setRoleTab('user');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                roleTab === 'user'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-primary" />
              Student / User
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab('admin');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                roleTab === 'admin'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-4 h-4 text-primary" />
              Institute Admin
            </button>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-2">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-foreground flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background border-input text-foreground text-xs"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@university.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-input text-foreground text-xs"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-foreground flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-background border-input text-foreground text-xs"
              />
            </div>

            {/* Role specific inputs */}
            {roleTab === 'admin' ? (
              <div className="space-y-1.5">
                <Label htmlFor="collegeName" className="text-xs font-medium text-foreground flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  College Name
                </Label>
                <Input
                  id="collegeName"
                  type="text"
                  placeholder="e.g. NIT Jamshedpur"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  required
                  className="bg-background border-input text-foreground text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  The system will automatically generate your college slug for ChromaDB multi-tenancy.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="collegeSlug" className="text-xs font-medium text-foreground flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  Target College Slug
                </Label>
                <Input
                  id="collegeSlug"
                  type="text"
                  placeholder="e.g. nitjsr, iitb"
                  value={collegeSlug}
                  onChange={(e) => setCollegeSlug(e.target.value)}
                  required
                  className="bg-background border-input text-foreground text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Ask your institute admin for your college slug.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              disabled={isLoading || !name.trim() || !email.trim() || !password}
              className="w-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registering Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Register as {roleTab === 'admin' ? 'Admin' : 'Student'}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-semibold">
                Sign in here
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;
