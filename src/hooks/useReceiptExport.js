import { useState, useRef } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import {
  TEMPLATE_IDS,
  PAGE_SIZES,
  downloadPdfFromJpeg,
} from '../modules/invoice/invoiceUtils';

const waitForFonts = async () => {
  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 80));
};

/**
 * Shared hook encapsulating PNG/JPEG image export (with native mobile share fallback)
 * and PDF download for rendered invoice/receipt templates.
 */
export function useReceiptExport({
  receiptTemplate,
  invoiceWidth,
  invoicePageSize,
  showToast,
}) {
  const printableCardRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [imageExportModal, setImageExportModal] = useState(null);

  const getExportWidth = () => {
    if (receiptTemplate === TEMPLATE_IDS.KHMER) {
      return Math.max(480, Number(invoiceWidth) || PAGE_SIZES.A4.widthPx);
    }
    return 460;
  };

  const closeImageExportModal = () => {
    if (imageExportModal?.blobUrl) {
      URL.revokeObjectURL(imageExportModal.blobUrl);
    }
    setImageExportModal(null);
  };

  const exportImage = async ({ format = 'png', filename, shareText, settleDelayMs = 150 }) => {
    if (isExporting) return;
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, settleDelayMs));
    await waitForFonts();

    try {
      const node = printableCardRef.current;
      if (!node) {
        throw new Error('Invoice template container element not found');
      }

      const exportWidth = getExportWidth();
      const options = {
        quality: format === 'jpeg' ? 0.98 : 0.98,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          transform: 'none',
          boxShadow: 'none',
          maxWidth: 'none',
          width: `${exportWidth}px`,
        },
      };

      const dataUrl = format === 'jpeg' ? await toJpeg(node, options) : await toPng(node, options);
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const file = new File([blob], filename, { type: mimeType });

      setImageExportModal({
        dataUrl,
        blobUrl,
        filename,
        file,
        format,
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: filename,
            text: shareText || `Wholesale Invoice - ${filename}`,
          });
          showToast('Invoice image shared / saved to photos!', 'success');
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            console.warn('Native share failed, modal preview active', shareErr);
          }
        }
      } else {
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Invoice generated! Long-press image to Save to Photos.', 'success');
      }
    } catch (err) {
      console.error('Export Image error:', err);
      showToast('Failed to generate image: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = async ({ filename, settleDelayMs = 150 }) => {
    if (isExporting) return;
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, settleDelayMs));
    await waitForFonts();

    try {
      const node = printableCardRef.current;
      if (!node) throw new Error('Invoice template container element not found');

      const exportWidth = getExportWidth();
      const jpegUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          transform: 'none',
          boxShadow: 'none',
          maxWidth: 'none',
          width: `${exportWidth}px`,
        },
      });

      const page = PAGE_SIZES[invoicePageSize] || PAGE_SIZES.A4;
      await downloadPdfFromJpeg(jpegUrl, filename, page);
      showToast('Invoice PDF downloaded.', 'success');
    } catch (err) {
      console.error('Export PDF error:', err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    printableCardRef,
    isExporting,
    imageExportModal,
    closeImageExportModal,
    exportImage,
    exportPdf,
  };
}

