import { Button, Card } from '../components';

export function HomePage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-2">Today's Activity</h3>
          <p className="text-grey-400 mb-4">Track your daily progress</p>
          <Button variant="primary" size="sm">View Details</Button>
        </Card>

        <Card variant="blue">
          <h3 className="text-lg font-semibold mb-2">Weekly Summary</h3>
          <p className="text-grey-300 mb-4">Overview of the past week</p>
          <Button variant="outline" size="sm">View Report</Button>
        </Card>

        <Card variant="green">
          <h3 className="text-lg font-semibold mb-2">Goals</h3>
          <p className="text-grey-300 mb-4">Track your targets</p>
          <Button variant="secondary" size="sm">Manage Goals</Button>
        </Card>
      </div>
    </div>
  );
}
