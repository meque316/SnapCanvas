"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Stage, Layer, Text, Transformer, Rect, Image as KonvaImage, Line } from "react-konva";
import jsPDF from "jspdf";

export default function Home() {

  // ✅ FIX: estado inicial desde localStorage (sin useEffect)
  const [elements, setElements] = useState(() => {
    try {
      const saved = localStorage.getItem("editor-data");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Error loading data:", error);
      return [];
    }
  });

  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [colorValue, setColorValue] = useState("#000000");
  const [guides, setGuides] = useState([]);

  const stageRef = useRef(null);
  const trRef = useRef(null);
  const fileInputRef = useRef(null);
  const objectsRef = useRef([]);

  const GUIDELINE_OFFSET = 5;

  // 🔥 Crear imagen (más eficiente)
  const createImage = (src) => {
    const img = new window.Image();
    img.src = src;
    return img;
  };

  const renderedElements = useMemo(() => {
    return elements.map((el) => {
      if (el.type === "image" && typeof el.image === "string") {
        return { ...el, imageObj: createImage(el.image) };
      }
      return el;
    });
  }, [elements]);

  // cache objetos
  useEffect(() => {
    if (!stageRef.current) return;
    objectsRef.current = stageRef.current.find(".object");
  }, [elements]);

  // guardar datos
  useEffect(() => {
    localStorage.setItem("editor-data", JSON.stringify(elements));
  }, [elements]);

  // snapping
  const getLineGuideStops = (skipShape) => {
    const stage = stageRef.current;
    const vertical = [0, stage.width() / 2, stage.width()];
    const horizontal = [0, stage.height() / 2, stage.height()];

    objectsRef.current.forEach((guideItem) => {
      if (guideItem === skipShape) return;
      const box = guideItem.getClientRect();

      vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
    });

    return { vertical, horizontal };
  };

  const handleDragMove = (e) => {
    const target = e.target;
    const { vertical, horizontal } = getLineGuideStops(target);
    const box = target.getClientRect();

    let snapX = 0;
    let snapY = 0;
    const newGuides = [];

    vertical.forEach((line) => {
      [box.x, box.x + box.width, box.x + box.width / 2].forEach((point) => {
        if (Math.abs(line - point) < GUIDELINE_OFFSET) {
          snapX = line - point;
          newGuides.push({ x: line, y: 0, orientation: "V" });
        }
      });
    });

    horizontal.forEach((line) => {
      [box.y, box.y + box.height, box.y + box.height / 2].forEach((point) => {
        if (Math.abs(line - point) < GUIDELINE_OFFSET) {
          snapY = line - point;
          newGuides.push({ x: 0, y: line, orientation: "H" });
        }
      });
    });

    target.x(target.x() + snapX);
    target.y(target.y() + snapY);

    setGuides(newGuides);
  };

  const handleTransformEnd = (node, id) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;

        return el.type === "text"
          ? { ...el, x: node.x(), y: node.y(), fontSize: el.fontSize * scaleX }
          : {
              ...el,
              x: node.x(),
              y: node.y(),
              width: el.width * scaleX,
              height: el.height * scaleY,
            };
      })
    );

    node.scaleX(1);
    node.scaleY(1);
  };

  const downloadPNG = () => {
    setSelectedId(null);
    setGuides([]);

    setTimeout(() => {
      const uri = stageRef.current.toDataURL({ pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = "diseno.png";
      link.href = uri;
      link.click();
    }, 100);
  };

  const exportPDF = () => {
    setSelectedId(null);
    setGuides([]);

    setTimeout(() => {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 3 });
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(dataUrl);

      const ratio = Math.min(
        pageWidth / imgProps.width,
        pageHeight / imgProps.height
      );

      const imgWidth = imgProps.width * ratio;
      const imgHeight = imgProps.height * ratio;

      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      pdf.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight);
      pdf.save("orden-produccion.pdf");
    }, 100);
  };

  const createId = () => crypto.randomUUID();

  const addText = () =>
    setElements((prev) => [
      ...prev,
      {
        id: createId(),
        type: "text",
        text: "Nuevo Texto",
        x: 100,
        y: 100,
        fontSize: 25,
        color: "#000",
      },
    ]);

  // 🔥 FIX importante
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setElements((prev) => [
        ...prev,
        {
          id: createId(),
          type: "image",
          image: reader.result,
          x: 50,
          y: 50,
          width: 200,
          height: 200,
        },
      ]);
    };

    reader.readAsDataURL(file);
  };

  const moveLayer = (direction) => {
    if (!selectedId) return;

    setElements((prev) => {
      const item = prev.find((el) => el.id === selectedId);
      const filtered = prev.filter((el) => el.id !== selectedId);

      return direction === "front"
        ? [...filtered, item]
        : [item, ...filtered];
    });
  };

  useEffect(() => {
    if (!trRef.current || editingId) return;

    const node = stageRef.current.findOne(`#el-${selectedId}`);

    if (node) {
      trRef.current.nodes([node]);
      trRef.current.getLayer().batchDraw();
    } else {
      trRef.current.nodes([]);
    }
  }, [selectedId, editingId, elements]);

  return (
    <main className="h-screen flex text-black">
      <div className="w-1/4 bg-gray-100 p-4 flex flex-col gap-2">
        <button onClick={addText} className="bg-blue-600 text-white p-2 rounded">Añadir Texto</button>
        <button onClick={() => fileInputRef.current.click()} className="bg-purple-600 text-white p-2 rounded">Subir Imagen</button>
        <button onClick={() => moveLayer("front")} className="bg-yellow-500 text-white p-2 rounded">Traer al frente</button>
        <button onClick={() => moveLayer("back")} className="bg-gray-500 text-white p-2 rounded">Enviar atrás</button>
        <button onClick={downloadPNG} className="bg-green-600 text-white p-2 rounded">PNG</button>
        <button onClick={exportPDF} className="bg-red-600 text-white p-2 rounded">PDF</button>
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
      </div>

      <div className="flex-1 flex justify-center items-center bg-gray-300 relative">
        <Stage width={500} height={500} ref={stageRef}>
          <Layer>
            <Rect width={500} height={500} fill="white" />

            {renderedElements.map((el) =>
              el.type === "image" ? (
                <KonvaImage
                  key={el.id}
                  id={`el-${el.id}`}
                  name="object"
                  image={el.imageObj}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  draggable
                  onDragMove={handleDragMove}
                  onDragEnd={() => setGuides([])}
                  onClick={() => setSelectedId(el.id)}
                  onTransformEnd={(e) => handleTransformEnd(e.target, el.id)}
                />
              ) : (
                <Text
                  key={el.id}
                  id={`el-${el.id}`}
                  name="object"
                  text={el.text}
                  x={el.x}
                  y={el.y}
                  fontSize={el.fontSize}
                  fill={el.color}
                  draggable={!editingId}
                  onClick={() => setSelectedId(el.id)}
                />
              )
            )}

            {selectedId && !editingId && <Transformer ref={trRef} />}
          </Layer>
        </Stage>
      </div>
    </main>
  );
}