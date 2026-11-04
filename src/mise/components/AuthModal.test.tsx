import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthModal } from './AuthModal';

describe('AuthModal', () => {
  it('respeita o modo solicitado ao reabrir após alternar entre cadastro e login', () => {
    const props = {
      onClose: vi.fn(),
      database: {} as any,
      onAuthSuccess: vi.fn(),
    };
    const { rerender } = render(
      <AuthModal {...props} isOpen initialMode="login" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar Nova Empresa' }));
    expect(
      screen.getByRole('button', { name: 'Cadastrar Empresa e Acessar' }),
    ).toBeInTheDocument();

    rerender(<AuthModal {...props} isOpen={false} initialMode="login" />);
    rerender(<AuthModal {...props} isOpen initialMode="login" />);

    expect(
      screen.getByRole('button', { name: 'Entrar com E-mail e Senha' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cadastrar Empresa e Acessar' }),
    ).not.toBeInTheDocument();
  });

  it('expõe um diálogo acessível, mantém o foco dentro e fecha com Escape', () => {
    const onClose = vi.fn();
    render(
      <AuthModal
        isOpen
        initialMode="login"
        onClose={onClose}
        database={{} as any}
        onAuthSuccess={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Mise' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const firstButton = buttons[0]!;
    const lastButton = buttons[buttons.length - 1]!;
    lastButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
