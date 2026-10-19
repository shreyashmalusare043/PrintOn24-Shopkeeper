import React from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ShopkeeperLayout } from '@/components/layouts/ShopkeeperLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AboutUsPage from '@/pages/AboutUsPage';
import DemoPage from '@/pages/DemoPage';
import PublicPricingPage from '@/pages/PublicPricingPage';
import EnquiryPage from '@/pages/EnquiryPage';
import DashboardPage from '@/pages/DashboardPage';
import OrdersPage from '@/pages/OrdersPage';
import QrPcManagementPage from '@/pages/QrPcManagementPage';
import PrintersPage from '@/pages/PrintersPage';
import PricingPage from '@/pages/PricingPage';
import MembershipsPage from '@/pages/MembershipsPage';
import FeedbackPage from '@/pages/FeedbackPage';
import ProfilePage from '@/pages/ProfilePage';
import ReportsPage from '@/pages/ReportsPage';
import RemindersPage from '@/pages/RemindersPage';
import SupportPage from '@/pages/SupportPage';
import PolicyPage from '@/pages/PolicyPage';
import TermsPage from '@/pages/TermsPage';
import SubscriptionPage from '@/pages/SubscriptionPage';
import SettingsPage from '@/pages/SettingsPage';
import GoForPrintPage from '@/pages/GoForPrintPage';
import OrderPreviewPage from '@/pages/OrderPreviewPage';
import QrShopRedirectPage from '@/pages/QrShopRedirectPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  // ---------------- PUBLIC PORTAL PAGES ----------------
  {
    name: 'Home Landing Page',
    path: '/',
    element: <LandingPage />,
    public: true,
  },
  {
    name: 'Shopkeeper Login',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: 'Authentication (Legacy / Redirect)',
    path: '/auth',
    element: <LoginPage />,
    public: true,
  },
  {
    name: 'About Us',
    path: '/about',
    element: <AboutUsPage />,
    public: true,
  },
  {
    name: 'Demo & Walkthrough',
    path: '/demo',
    element: <DemoPage />,
    public: true,
  },
  {
    name: 'Public Pricing Packages',
    path: '/pricing',
    element: <PublicPricingPage />,
    public: true,
  },
  {
    name: 'Shopkeeper Partner Enquiry',
    path: '/enquiry',
    element: <EnquiryPage />,
    public: true,
  },
  {
    name: 'Customer Shop QR Redirect',
    path: '/shop/:shopCode',
    element: <QrShopRedirectPage />,
    public: true,
    visible: false,
  },

  // ---------------- SHOPKEEPER WORKSTATION DASHBOARD ----------------
  {
    name: 'Shopkeeper Dashboard',
    path: '/dashboard',
    element: (
      <ShopkeeperLayout>
        <DashboardPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Live Orders & Queue',
    path: '/orders',
    element: (
      <ShopkeeperLayout>
        <OrdersPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Admin Orders Direct Route',
    path: '/admin/orders',
    element: <Navigate to="/orders" replace />,
    visible: false,
  },
  {
    name: 'Admin Base Direct Route',
    path: '/admin',
    element: <Navigate to="/orders" replace />,
    visible: false,
  },
  {
    name: 'Order Document Preview',
    path: '/orders/:orderId/preview',
    element: (
      <ShopkeeperLayout>
        <OrderPreviewPage />
      </ShopkeeperLayout>
    ),
    visible: false,
  },
  {
    name: 'Order Document Item Preview',
    path: '/orders/:orderId/documents/:documentId/preview',
    element: (
      <ShopkeeperLayout>
        <OrderPreviewPage />
      </ShopkeeperLayout>
    ),
    visible: false,
  },
  {
    name: 'QR Code & PC Management',
    path: '/qr-pc',
    element: (
      <ShopkeeperLayout>
        <QrPcManagementPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Printer Configuration',
    path: '/printers',
    element: (
      <ShopkeeperLayout>
        <PrintersPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Store Pricing & Page Configuration',
    path: '/pricing-config',
    element: (
      <ShopkeeperLayout>
        <PricingPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Store Pricing & Page Configuration (Alias)',
    path: '/shop-pricing',
    element: (
      <ShopkeeperLayout>
        <PricingPage />
      </ShopkeeperLayout>
    ),
    visible: false,
  },
  {
    name: 'Membership Management',
    path: '/memberships',
    element: (
      <ShopkeeperLayout>
        <MembershipsPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Feedback Moderation',
    path: '/feedback',
    element: (
      <ShopkeeperLayout>
        <FeedbackPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Shop Profile',
    path: '/profile',
    element: (
      <ShopkeeperLayout>
        <ProfilePage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Reports & Analytics',
    path: '/reports',
    element: (
      <ShopkeeperLayout>
        <ReportsPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Page Reminders',
    path: '/reminders',
    element: (
      <ShopkeeperLayout>
        <RemindersPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Help & Support',
    path: '/support',
    element: (
      <ShopkeeperLayout>
        <SupportPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Platform Policy',
    path: '/policy',
    element: (
      <ShopkeeperLayout>
        <PolicyPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Terms & Conditions',
    path: '/terms',
    element: (
      <ShopkeeperLayout>
        <TermsPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Subscription Plans',
    path: '/subscription',
    element: (
      <ShopkeeperLayout>
        <SubscriptionPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'App Settings & Security',
    path: '/settings',
    element: (
      <ShopkeeperLayout>
        <SettingsPage />
      </ShopkeeperLayout>
    ),
  },
  {
    name: 'Go For Print - One-Click Direct',
    path: '/go-for-print',
    element: (
      <ShopkeeperLayout>
        <GoForPrintPage />
      </ShopkeeperLayout>
    ),
  },
];
