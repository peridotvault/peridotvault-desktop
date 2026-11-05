import { LoginScreen } from '@login/pages/login';
import { createHashRouter } from 'react-router-dom';

const router = createHashRouter([
  {
    path: '/',
    element: <LoginScreen />,
  },
]);

export default router;
