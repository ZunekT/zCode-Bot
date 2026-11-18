import { defineModule } from '../../core/types.js';
import { orderCommand } from './commands.js';
import { orderComponents } from './components.js';
import { orderJobs } from './jobs.js';

export const ordersModule = defineModule({
  name: 'orders',
  description: 'Zlecenia ZX-xxxx, wpłaty i faktury proforma',
  commands: [orderCommand],
  components: orderComponents,
  jobs: orderJobs,
});
