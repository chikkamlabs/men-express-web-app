import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OnlineOrder } from '@/lib/onlineordersStore';

/**
 * Generate and download a clean shipping invoice in an A4 sheet
 * sized strictly as a 5 inch x 3 inch shipping label box.
 * Contains Order details, Customer details, Shipping details, and Order items with qty.
 * No QR codes or external branding.
 */
export function generateInvoice(order: OnlineOrder): void {
  // A4 Page: 8.27 in x 11.69 in (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'a4',
  });

  const startX = 0.5; // Left margin in inches
  const startY = 0.5; // Top margin in inches
  const boxWidth = 5.0; // Fixed 5 inch width

  // 1. Header Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MEN EXPRESS - SHIPPING INVOICE', startX + 0.1, startY + 0.22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Standard Delivery', startX + boxWidth - 0.1, startY + 0.22, { align: 'right' });

  // Divider line below header
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.01);
  doc.line(startX, startY + 0.3, startX + boxWidth, startY + 0.3);

  // 2. Two-column Section: Shipping Details (Left) & Order Details (Right)
  const colDividerX = startX + 2.85;
  doc.line(colDividerX, startY + 0.3, colDividerX, startY + 1.25);

  // Left Column: Customer & Shipping Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SHIP TO:', startX + 0.1, startY + 0.44);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(order.customer_name || 'Valued Customer', startX + 0.1, startY + 0.58);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const addressText = order.customer_address?.address || 'No street address provided';
  const splitAddress = doc.splitTextToSize(addressText, 2.65);
  doc.text(splitAddress, startX + 0.1, startY + 0.7);

  let currentYLeft = startY + 0.7 + splitAddress.length * 0.11;
  const cityState = [
    order.customer_address?.city,
    order.customer_address?.state,
    order.customer_address?.postal_code ? `- ${order.customer_address.postal_code}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (cityState) {
    doc.text(cityState, startX + 0.1, currentYLeft);
    currentYLeft += 0.11;
  }

  const phone = order.customer_mobile || order.customer_address?.mobile_alt || '—';
  doc.text(`Mobile: ${phone}`, startX + 0.1, currentYLeft);

  // Right Column: Order Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ORDER DETAILS:', colDividerX + 0.1, startY + 0.44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Order ID: `, colDividerX + 0.1, startY + 0.58);
  doc.setFont('helvetica', 'bold');
  doc.text(`${order.order_id}`, colDividerX + 0.65, startY + 0.58);

  doc.setFont('helvetica', 'normal');
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
  doc.text(`Date: ${orderDate}`, colDividerX + 0.1, startY + 0.7);

  const paymentMethodText = order.payment ? order.payment.toUpperCase() : 'PENDING';
  doc.text(`Payment: ${paymentMethodText}`, colDividerX + 0.1, startY + 0.82);

  doc.text(`Items Qty: ${(order.items || []).reduce((acc, item) => acc + (item.quantity || 1), 0)}`, colDividerX + 0.1, startY + 0.94);

  doc.setFont('helvetica', 'bold');
  doc.text(`Amount: Rs. ${Number(order.payable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colDividerX + 0.1, startY + 1.08);

  // Divider line before Items table
  doc.line(startX, startY + 1.25, startX + boxWidth, startY + 1.25);

  // 3. Order Items Table using jspdf-autotable
  const items = order.items && order.items.length > 0
    ? order.items
    : [
        {
          id: '1',
          order_id: order.id,
          prod_id: 'default',
          product_name: 'Apparel Item',
          quantity: 1,
          size: 'Standard',
          s_p: order.payable_amount || 0,
          row_total: order.payable_amount || 0,
        },
      ];

  const tableRows = items.map((item, index) => [
    (index + 1).toString(),
    item.product_name || 'Clothing Item',
    item.size || '—',
    (item.quantity || 1).toString(),
    `Rs. ${Number(item.s_p || 0).toFixed(2)}`,
    `Rs. ${Number(item.row_total || 0).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: startY + 1.25,
    margin: { left: startX, right: 8.27 - (startX + boxWidth) },
    tableWidth: boxWidth,
    head: [['#', 'Item Description', 'Size', 'Qty', 'Price', 'Total']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontSize: 6.5,
      fontStyle: 'bold',
      cellPadding: 0.04,
      lineWidth: 0.005,
      lineColor: [200, 200, 200],
    },
    bodyStyles: {
      textColor: [30, 30, 30],
      fontSize: 6.5,
      cellPadding: 0.04,
      lineWidth: 0.005,
      lineColor: [220, 220, 220],
    },
    columnStyles: {
      0: { cellWidth: 0.25, halign: 'center' },
      1: { cellWidth: 2.25 },
      2: { cellWidth: 0.5, halign: 'center' },
      3: { cellWidth: 0.4, halign: 'center' },
      4: { cellWidth: 0.8, halign: 'right' },
      5: { cellWidth: 0.8, halign: 'right' },
    },
    foot: [
      [
        '',
        'Delivery Charges',
        '',
        '',
        '',
        `Rs. ${Number(order.delivery_charges || 0).toFixed(2)}`,
      ],
      [
        '',
        'Total Payable Amount',
        '',
        items.reduce((s, it) => s + (it.quantity || 1), 0).toString(),
        '',
        `Rs. ${Number(order.payable_amount || 0).toFixed(2)}`,
      ],
    ],
    footStyles: {
      fillColor: [250, 250, 250],
      textColor: [0, 0, 0],
      fontSize: 6.5,
      fontStyle: 'bold',
      cellPadding: 0.04,
      lineWidth: 0.005,
      lineColor: [200, 200, 200],
    },
  });

  // Calculate final height: 5 inch width by 3 inch height (expand boundary if table extends)
  const finalTableY = (doc as any).lastAutoTable?.finalY || (startY + 2.6);
  const totalBoxHeight = Math.max(3.0, finalTableY - startY + 0.15);

  // Outer Border Box (5 inch width * 3 inch height)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.015);
  doc.rect(startX, startY, boxWidth, totalBoxHeight);

  // Save the PDF
  doc.save(`Invoice_${order.order_id || 'order'}.pdf`);
}
