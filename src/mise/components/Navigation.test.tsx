import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Navigation, type TabKey } from './Navigation';

const database = {
  activeUserId: 'owner',
  activeStoreId: 'CONSOLIDATED',
  company: { name: 'Casa Mise' },
  stores: [],
  users: [{ id: 'owner', name: 'Ana Silva' }],
} as never;

function NavigationHarness() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeTab: TabKey = 'dashboard';

  return (
    <div>
      <Navigation
        activeTab={activeTab}
        onSelectTab={() => {}}
        database={database}
        onSelectStore={() => {}}
        onLogout={() => {}}
        onViewLandingPage={() => {}}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
      />
      <main
        data-testid="main-content"
        className={isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-60'}
      >
        Conteúdo principal
      </main>
    </div>
  );
}

describe('Navegação lateral recolhível', () => {
  it('recolhe para uma faixa compacta e permite expandir novamente sem perder a navegação', () => {
    render(<NavigationHarness />);

    const sidebar = document.getElementById('mise-desktop-sidebar');
    const main = screen.getByTestId('main-content');
    const collapseButton = screen.getByRole('button', { name: 'Recolher menu lateral' });

    expect(screen.queryByRole('button', { name: 'Integrações' })).not.toBeInTheDocument();

    expect(sidebar).toHaveClass('w-60');
    expect(main).toHaveClass('md:ml-60');
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(collapseButton);

    expect(sidebar).toHaveClass('w-[72px]');
    expect(main).toHaveClass('md:ml-[72px]');
    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getAllByRole('button', { name: 'Painel' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('combobox', { name: /Selecionar loja/ }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu lateral' }));

    expect(sidebar).toHaveClass('w-60');
    expect(main).toHaveClass('md:ml-60');
    expect(screen.getByRole('button', { name: 'Recolher menu lateral' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
