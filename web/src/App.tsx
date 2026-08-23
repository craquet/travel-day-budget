import { StoreProvider, useStore } from './store';
import { TripScreen } from './screens/TripScreen';
import { TripsScreen } from './screens/TripsScreen';
import { Spinner, Toasts } from './components/ui';

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}

function Root() {
  const { ready, trip, selectTrip } = useStore();

  return (
    <>
      <Toasts />
      {!ready && <Spinner />}
      {ready &&
        (trip ? <TripScreen key={trip.id} onBack={() => selectTrip(null)} /> : <TripsScreen />)}
    </>
  );
}
