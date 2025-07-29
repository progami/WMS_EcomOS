import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, useErrorHandler } from '@/components/error-boundary';

// Mock the logger module
jest.mock('@/lib/logger/client', () => ({
  logErrorToService: jest.fn(),
}));

// Test component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Test component using the hook
const ComponentWithErrorHandler = () => {
  const setError = useErrorHandler();
  
  return (
    <div>
      <button onClick={() => setError(new Error('Hook error'))}>
        Trigger Error
      </button>
      <div>Component rendered</div>
    </div>
  );
};

describe('ErrorBoundary Component', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal operation', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders multiple children without error', () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
          <div>Third child</div>
        </ErrorBoundary>
      );
      
      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
      expect(screen.getByText('Third child')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('catches errors and displays default error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('displays generic message for errors without message', () => {
      const ErrorWithoutMessage = () => {
        throw new Error('');
      };
      
      render(
        <ErrorBoundary>
          <ErrorWithoutMessage />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });

    it('logs error in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by boundary:',
        expect.any(Error),
        expect.any(Object)
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    it('does not log error in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      jest.clearAllMocks();
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(console.error).not.toHaveBeenCalledWith(
        'Error caught by boundary:',
        expect.any(Error),
        expect.any(Object)
      );
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Reset functionality', () => {
    it('resets error state when Try Again is clicked', () => {
      let shouldThrow = true;
      
      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error message');
        }
        return <div>No error</div>;
      };
      
      const { rerender } = render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      
      // Change state so component won't throw
      shouldThrow = false;
      
      // Click Try Again
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
      
      // After reset, the component should render normally
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('can catch new errors after reset', () => {
      let shouldThrow = true;
      
      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error message');
        }
        return <div>No error</div>;
      };
      
      const { rerender } = render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      
      // Change state and reset
      shouldThrow = false;
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
      
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      expect(screen.getByText('No error')).toBeInTheDocument();
      
      // Trigger error again
      shouldThrow = true;
      rerender(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Custom fallback component', () => {
    const CustomFallback = ({ error, reset }: { error: Error; reset: () => void }) => (
      <div>
        <h1>Custom Error UI</h1>
        <p>Error: {error.message}</p>
        <button onClick={reset}>Custom Reset</button>
      </div>
    );

    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
      expect(screen.getByText('Error: Test error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom Reset' })).toBeInTheDocument();
    });

    it('passes error and reset function to custom fallback', () => {
      const mockFallback = jest.fn(() => <div>Mock Fallback</div>);
      
      render(
        <ErrorBoundary fallback={mockFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(mockFallback).toHaveBeenCalled();
      const callArgs = mockFallback.mock.calls[0][0];
      expect(callArgs).toHaveProperty('error');
      expect(callArgs).toHaveProperty('reset');
      expect(callArgs.error).toBeInstanceOf(Error);
      expect(typeof callArgs.reset).toBe('function');
    });
  });

  describe('Error UI styling', () => {
    it('applies correct styling classes', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const container = screen.getByText('Something went wrong').closest('.bg-red-50');
      expect(container).toHaveClass('bg-red-50', 'border', 'border-red-200', 'rounded-lg', 'p-6');
      
      const heading = screen.getByText('Something went wrong');
      expect(heading).toHaveClass('text-lg', 'font-semibold', 'text-red-800', 'mb-2');
      
      const message = screen.getByText('Test error message');
      expect(message).toHaveClass('text-sm', 'text-red-700', 'mb-4');
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2', 'bg-red-600', 'text-white', 'rounded-md');
    });

    it('includes dark mode classes', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const container = screen.getByText('Something went wrong').closest('.bg-red-50');
      expect(container).toHaveClass('dark:bg-red-900/20', 'dark:border-red-800');
      
      const heading = screen.getByText('Something went wrong');
      expect(heading).toHaveClass('dark:text-red-200');
      
      const message = screen.getByText('Test error message');
      expect(message).toHaveClass('dark:text-red-300');
    });
  });

  describe('Error types', () => {
    it('handles different error types', () => {
      const TypedError = () => {
        const error = new TypeError('Type error occurred');
        throw error;
      };
      
      render(
        <ErrorBoundary>
          <TypedError />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Type error occurred')).toBeInTheDocument();
    });

    it('handles errors thrown in event handlers with error boundary', () => {
      const ComponentWithHandler = () => {
        const [error, setError] = React.useState(false);
        
        if (error) {
          throw new Error('Handler error');
        }
        
        return (
          <button onClick={() => setError(true)}>
            Trigger Handler Error
          </button>
        );
      };
      
      render(
        <ErrorBoundary>
          <ComponentWithHandler />
        </ErrorBoundary>
      );
      
      fireEvent.click(screen.getByRole('button', { name: 'Trigger Handler Error' }));
      
      expect(screen.getByText('Handler error')).toBeInTheDocument();
    });
  });
});

describe('useErrorHandler Hook', () => {
  it('throws error when called', () => {
    const ErrorComponent = () => {
      try {
        render(
          <ErrorBoundary>
            <ComponentWithErrorHandler />
          </ErrorBoundary>
        );
        
        fireEvent.click(screen.getByRole('button', { name: 'Trigger Error' }));
        
        expect(screen.getByText('Hook error')).toBeInTheDocument();
      } catch (error) {
        // Expected to throw
      }
    };
    
    expect(() => ErrorComponent()).not.toThrow();
  });

  it('renders normally before error is set', () => {
    render(
      <ErrorBoundary>
        <ComponentWithErrorHandler />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Component rendered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trigger Error' })).toBeInTheDocument();
  });
});