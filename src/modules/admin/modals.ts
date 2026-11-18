import { Form } from '../../ui/builders/modal.js';

export function paymentDetailsModal(current: string | null) {
  return new Form('config:paymentsSubmit', 'Dane do przelewu')
    .info(
      'Te dane pojawią się na każdej fakturze proforma. Numer sprawy (np. **ZX-0042**) bot dopisze sam jako tytuł przelewu.',
    )
    .text({
      id: 'details',
      label: 'Dane do przelewu',
      description: 'Odbiorca, numer konta, bank, ewentualnie BLIK / PayPal',
      paragraph: true,
      max: 1000,
      value: current ?? undefined,
      placeholder: 'Odbiorca: Jan Kowalski\nNr konta: PL00 0000 0000 0000 0000 0000 0000',
    })
    .build();
}
