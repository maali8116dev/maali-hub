import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import headerLogo from "../../images/header_logo.png";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation(['navigation', 'common']);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    // { code: 'pt', name: 'Português' }
  ];

  const currentLang = i18n.language || 'en';

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  const navigationItems = [
    { href: '/', label: t('navigation:home') },
    { href: '/opportunities', label: t('navigation:opportunities') },
    { href: '/about', label: t('navigation:about') },
    { href: '/resources', label: t('navigation:resources') },
    { href: '/blog', label: t('navigation:blog') },
    { href: '/contact', label: t('navigation:contact') }
  ];

  return (
    <nav className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/">
                <img src={headerLogo} alt="Maali Opportunity Hub" className="h-8 w-auto" />
              </Link>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname === item.href 
                      ? "text-primary bg-primary/10" 
                      : "text-foreground hover:text-primary"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Language Selector, Theme Toggle & CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <ThemeToggle />
            <div className="relative group">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {languages.find(lang => lang.code === currentLang)?.name}
              </Button>
              <div className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-md shadow-soft opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={cn(
                      "block w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors",
                      currentLang === lang.code && "bg-muted text-primary"
                    )}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
            {user ? (
              <div className="flex items-center space-x-4">
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  {t('navigation:dashboard')}
                </Button>
                <Button variant="outline" onClick={signOut}>
                  {t('navigation:signOut')}
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate("/auth")}>
                  {t('navigation:login')}
                </Button>
                <Button variant="hero" onClick={() => navigate("/join")}>
                  Join Maali
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button - larger touch target */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-foreground hover:text-primary p-3 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-card border-t border-border max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-3 pt-3 pb-4 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  " px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[48px] flex items-center",
                  location.pathname === item.href 
                    ? "text-primary bg-primary/10" 
                    : "text-foreground hover:text-primary hover:bg-muted/50"
                )}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            
            {/* Language selector for mobile */}
            <div className="px-4 py-3 border-t border-border mt-2">
              <p className="text-sm text-muted-foreground mb-2">{t('navigation:language')}</p>
              <div className="flex gap-2 flex-wrap">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-md min-h-[40px] transition-colors",
                      currentLang === lang.code 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-3 pb-2 space-y-2 border-t border-border mt-2">
              {user ? (
                <>
                  <Button variant="outline" className="w-full min-h-[48px]" onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }}>
                    {t('navigation:dashboard')}
                  </Button>
                  <Button variant="outline" className="w-full min-h-[48px]" onClick={signOut}>
                    {t('navigation:signOut')}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full min-h-[48px]" onClick={() => { navigate("/auth"); setIsMenuOpen(false); }}>
                    {t('navigation:login')}
                  </Button>
                  <Button variant="hero" className="w-full min-h-[48px]" onClick={() => { navigate("/join"); setIsMenuOpen(false); }}>
                    Join Maali
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;








