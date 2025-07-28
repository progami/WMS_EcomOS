import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageHeader, HelpfulTips } from '@/components/ui/page-header';
import { Info, AlertCircle, HelpCircle } from 'lucide-react';

describe('PageHeader Component', () => {
  describe('Basic rendering', () => {
    it('renders with only title', () => {
      render(<PageHeader title="Dashboard" />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
      expect(screen.getByText('Dashboard')).toHaveClass('text-3xl', 'font-bold', 'mb-2');
    });

    it('renders with title and subtitle', () => {
      render(<PageHeader title="Inventory" subtitle="Manage your warehouse inventory" />);
      
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.getByText('Manage your warehouse inventory')).toBeInTheDocument();
      expect(screen.getByText('Manage your warehouse inventory')).toHaveClass('text-muted-foreground');
    });

    it('renders without description (description prop not supported)', () => {
      render(
        <PageHeader
          title="Reports"
        />
      );
      
      expect(screen.getByText('Reports')).toBeInTheDocument();
      // PageHeader doesn't support description prop
    });

    it('renders with all props', () => {
      render(
        <PageHeader
          title="Analytics"
          subtitle="Business Intelligence"
          actions={<button>Export</button>}
        />
      );
      
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Business Intelligence')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
      // PageHeader doesn't support icon or description props
    });
  });

  describe('Actions slot', () => {
    it('renders action buttons', () => {
      render(
        <PageHeader
          title="Products"
          actions={
            <>
              <button>Add Product</button>
              <button>Export</button>
            </>
          }
        />
      );
      
      expect(screen.getByRole('button', { name: 'Add Product' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    });

    it('positions actions correctly', () => {
      render(
        <PageHeader
          title="Orders"
          actions={<button>New Order</button>}
        />
      );
      
      const actionsContainer = screen.getByRole('button').parentElement;
      expect(actionsContainer).toHaveClass('flex', 'items-center', 'gap-2');
    });
  });

  describe('Styling and customization', () => {
    it('applies default container styling', () => {
      render(
        <PageHeader
          title="Test"
          subtitle="Test subtitle"
        />
      );
      
      const container = screen.getByText('Test').closest('.bg-white');
      expect(container).toHaveClass('bg-white', 'border', 'rounded-lg', 'p-6');
      
      const heading = screen.getByText('Test');
      expect(heading).toHaveClass('text-3xl', 'font-bold', 'mb-2');
      
      const subtitle = screen.getByText('Test subtitle');
      expect(subtitle).toHaveClass('text-muted-foreground');
    });

    it('renders with proper layout structure', () => {
      render(
        <PageHeader
          title="Alert"
          subtitle="Important information"
          actions={<button>Action</button>}
        />
      );
      
      const container = screen.getByText('Alert').closest('.bg-white');
      expect(container).toHaveClass('bg-white', 'border', 'rounded-lg', 'p-6');
      
      const flexContainer = screen.getByText('Alert').closest('.flex');
      expect(flexContainer).toHaveClass('flex', 'items-center', 'justify-between', 'mb-4');
      
      const actionsContainer = screen.getByRole('button').parentElement;
      expect(actionsContainer).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('maintains proper spacing', () => {
      render(<PageHeader title="Test" />);
      
      const container = screen.getByText('Test').closest('.bg-white');
      expect(container).toHaveClass('border', 'rounded-lg', 'p-6');
    });
  });

  describe('Edge cases', () => {
    it('renders without subtitle or actions', () => {
      render(
        <PageHeader
          title="Minimal Header"
        />
      );
      
      expect(screen.getByText('Minimal Header')).toBeInTheDocument();
      expect(screen.queryByText('text-muted-foreground')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders with only actions', () => {
      render(
        <PageHeader
          title="With Actions Only"
          actions={<button>Click me</button>}
        />
      );
      
      expect(screen.getByText('With Actions Only')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });
  });
});

describe('HelpfulTips Component', () => {
  const defaultTips = [
    'Tip 1: Always save your work',
    'Tip 2: Use keyboard shortcuts',
    'Tip 3: Check the documentation'
  ];

  describe('Basic rendering', () => {
    it('renders with default title', () => {
      render(<HelpfulTips tips={defaultTips} />);
      
      expect(screen.getByText('Helpful Tips:')).toBeInTheDocument();
    });

    it('renders with custom title', () => {
      render(<HelpfulTips title="Pro Tips:" tips={defaultTips} />);
      
      expect(screen.getByText('Pro Tips:')).toBeInTheDocument();
    });

    it('renders all tips as list items', () => {
      render(<HelpfulTips tips={defaultTips} />);
      
      defaultTips.forEach(tip => {
        expect(screen.getByText(tip)).toBeInTheDocument();
      });
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('renders empty tips array', () => {
      render(<HelpfulTips tips={[]} />);
      
      expect(screen.getByText('Helpful Tips:')).toBeInTheDocument();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });
  });

  describe('Styling and customization', () => {
    it('applies default colors', () => {
      render(<HelpfulTips tips={defaultTips} icon={Info} />);
      
      const container = screen.getByText('Helpful Tips:').closest('.bg-blue-50');
      expect(container).toHaveClass('bg-blue-50', 'border', 'border-blue-200', 'rounded-lg', 'p-4');
      
      const icon = document.querySelector('svg');
      expect(icon).toHaveClass('text-blue-600');
      
      const text = screen.getByText('Helpful Tips:').parentElement;
      expect(text).toHaveClass('text-blue-800');
    });

    it('applies custom colors', () => {
      render(
        <HelpfulTips
          tips={defaultTips}
          icon={AlertCircle}
          iconColor="text-yellow-600"
          bgColor="bg-yellow-50"
          borderColor="border-yellow-200"
          textColor="text-yellow-800"
        />
      );
      
      const container = screen.getByText('Helpful Tips:').closest('.bg-yellow-50');
      expect(container).toHaveClass('bg-yellow-50', 'border', 'border-yellow-200', 'rounded-lg', 'p-4');
      
      const icon = document.querySelector('svg');
      expect(icon).toHaveClass('text-yellow-600');
      
      const text = screen.getByText('Helpful Tips:').parentElement;
      expect(text).toHaveClass('text-yellow-800');
    });

    it('applies list styling', () => {
      render(<HelpfulTips tips={defaultTips} />);
      
      const list = screen.getByRole('list');
      expect(list).toHaveClass('list-disc', 'list-inside', 'space-y-1');
    });
  });

  describe('Icon rendering', () => {
    it('renders icon when provided', () => {
      render(<HelpfulTips tips={defaultTips} icon={Info} />);
      
      const icon = document.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-5', 'w-5', 'mt-0.5', 'mr-3', 'flex-shrink-0');
    });

    it('does not render icon when not provided', () => {
      render(<HelpfulTips tips={defaultTips} />);
      
      expect(document.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles long tips text', () => {
      const longTips = [
        'This is a very long tip that might wrap to multiple lines and should still display correctly within the component layout',
        'Another long tip with lots of information'
      ];
      
      render(<HelpfulTips tips={longTips} />);
      
      longTips.forEach(tip => {
        expect(screen.getByText(tip)).toBeInTheDocument();
      });
    });

    it('handles special characters in tips', () => {
      const specialTips = [
        'Use the & symbol carefully',
        'HTML entities like <div> should be escaped',
        'Quotes "like this" should work'
      ];
      
      render(<HelpfulTips tips={specialTips} />);
      
      expect(screen.getByText('Use the & symbol carefully')).toBeInTheDocument();
      expect(screen.getByText('HTML entities like <div> should be escaped')).toBeInTheDocument();
      expect(screen.getByText('Quotes "like this" should work')).toBeInTheDocument();
    });
  });

  describe('Integration with PageHeader', () => {
    it('can be used together with PageHeader', () => {
      render(
        <div>
          <PageHeader
            title="User Guide"
            subtitle="Learn how to use the system"
          />
          <HelpfulTips
            tips={['Start with the basics', 'Practice regularly', 'Ask for help when needed']}
            icon={Info}
          />
        </div>
      );
      
      expect(screen.getByText('User Guide')).toBeInTheDocument();
      expect(screen.getByText('Start with the basics')).toBeInTheDocument();
    });
  });
});